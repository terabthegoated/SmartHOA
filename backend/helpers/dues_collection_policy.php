<?php
/**
 * SmartHOA payment-policy engine.
 *
 * The engine follows Board Resolution No. 12 (Series of 2025): dues are
 * payable on or before the 16th, then a 10% compound charge applies to the
 * documented unpaid balance after that date. It deliberately never freezes or
 * suspends an account automatically. The third monthly stage is recorded as a
 * hearing-required case for Board and Grievance Committee review.
 */

require_once __DIR__ . '/fcm.php';
require_once __DIR__ . '/payment_reminders.php';

function dues_policy_today($date = null) {
    $timezone = new DateTimeZone('Asia/Manila');

    if ($date instanceof DateTimeInterface) {
        return DateTimeImmutable::createFromInterface($date)->setTimezone($timezone)->setTime(0, 0, 0);
    }

    if (is_string($date) && trim($date) !== '') {
        try {
            return (new DateTimeImmutable($date, $timezone))->setTime(0, 0, 0);
        } catch (Exception $exception) {
            throw new InvalidArgumentException('The policy run date must be a valid date.');
        }
    }

    return (new DateTimeImmutable('today', $timezone))->setTime(0, 0, 0);
}

function dues_policy_stage($monthsOverdue) {
    if ($monthsOverdue >= 3) {
        return 'third_notice_hearing';
    }
    if ($monthsOverdue === 2) {
        return 'second_notice';
    }
    return 'first_notice';
}

function dues_policy_stage_label($stage) {
    $labels = array(
        'first_notice' => 'First Notice',
        'second_notice' => 'Second Notice – Demand Letter',
        'third_notice_hearing' => 'Third Notice – Hearing Required'
    );

    return $labels[$stage] ?? 'Collection review';
}

/**
 * Consolidate recorded unpaid dues by their due date. Each bill remains an
 * original record; this function only prepares an in-memory balance view.
 */
function dues_policy_periods_from_rows(array $paymentRows, DateTimeInterface $asOf, $includeFutureDueDates = false) {
    $timezone = new DateTimeZone('Asia/Manila');
    $asOfDate = DateTimeImmutable::createFromInterface($asOf)->setTimezone($timezone)->setTime(0, 0, 0);
    $periods = array();

    foreach ($paymentRows as $row) {
        $amount = round((float) ($row['amount_due'] ?? 0), 2);
        if ($amount <= 0 || empty($row['due_date'])) {
            continue;
        }

        try {
            $dueDate = (new DateTimeImmutable((string) $row['due_date'], $timezone))->setTime(0, 0, 0);
        } catch (Exception $exception) {
            continue;
        }

        if (!$includeFutureDueDates && $dueDate > $asOfDate) {
            continue;
        }

        $periodKey = $dueDate->format('Y-m-d');
        if (!isset($periods[$periodKey])) {
            $periods[$periodKey] = array(
                'due_date' => $dueDate,
                'base_amount' => 0.0
            );
        }
        $periods[$periodKey]['base_amount'] = round($periods[$periodKey]['base_amount'] + $amount, 2);
    }

    ksort($periods);
    return $periods;
}

/**
 * Apply the compounding policy to structured due-date periods. A payment due
 * on the 16th stays payable through that day; interest begins the following
 * calendar day. This matches the "on or before the 16th" Board rule.
 */
function dues_policy_calculate_periods(array $periods, DateTimeInterface $asOf) {
    $timezone = new DateTimeZone('Asia/Manila');
    $asOfDate = DateTimeImmutable::createFromInterface($asOf)->setTimezone($timezone)->setTime(0, 0, 0);
    $runningBalance = 0.0;
    $baseBalance = 0.0;
    $monthsOverdue = 0;
    $oldestDueDate = null;

    foreach ($periods as $period) {
        $baseAmount = round((float) ($period['base_amount'] ?? 0), 2);
        if ($baseAmount <= 0 || empty($period['due_date'])) {
            continue;
        }

        $dueDate = $period['due_date'] instanceof DateTimeInterface
            ? DateTimeImmutable::createFromInterface($period['due_date'])->setTimezone($timezone)->setTime(0, 0, 0)
            : new DateTimeImmutable((string) $period['due_date'], $timezone);

        $baseBalance = round($baseBalance + $baseAmount, 2);
        $runningBalance = round($runningBalance + $baseAmount, 2);

        if ($asOfDate > $dueDate) {
            $runningBalance = round($runningBalance * 1.10, 2);
            $monthsOverdue++;
            if ($oldestDueDate === null) {
                $oldestDueDate = $dueDate;
            }
        }
    }

    return array(
        'base_balance' => round($baseBalance, 2),
        'total_balance' => round($runningBalance, 2),
        'interest_amount' => round($runningBalance - $baseBalance, 2),
        'months_overdue' => $monthsOverdue,
        'oldest_due_date' => $oldestDueDate
    );
}

function dues_policy_current_month_key(DateTimeInterface $date) {
    return DateTimeImmutable::createFromInterface($date)->format('Y-m-01');
}

function dues_policy_fetch_active_residents(PDO $db, DateTimeInterface $today) {
    $statement = $db->prepare("\n        SELECT rp.resident_id, rp.user_id\n        FROM resident_profiles rp\n        INNER JOIN properties p ON p.property_id = rp.property_id\n        WHERE rp.resident_status = 'Active'\n          AND p.property_status = 'Occupied'\n          AND (rp.move_in_date IS NULL OR rp.move_in_date <= ?)\n        ORDER BY rp.created_at ASC\n    ");
    $statement->execute([DateTimeImmutable::createFromInterface($today)->format('Y-m-d')]);
    return $statement->fetchAll(PDO::FETCH_ASSOC);
}

function dues_policy_fetch_unpaid_rows(PDO $db, $residentId, DateTimeInterface $asOf) {
    $statement = $db->prepare("\n        SELECT p.payment_id, p.billing_month, p.due_date, p.amount_due, p.payment_status\n        FROM payments p\n        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id\n        WHERE p.resident_id = ?\n          AND p.payment_status IN ('Pending', 'Overdue')\n          AND p.due_date <= ?\n          AND LOWER(pt.payment_name) IN ('monthly hoa dues', 'monthly hoa dues + penalty')\n          AND NOT EXISTS (\n              SELECT 1 FROM payment_receipts pr WHERE pr.payment_id = p.payment_id\n          )\n        ORDER BY p.due_date ASC, p.billing_month ASC, p.created_at ASC\n    ");
    $statement->execute([$residentId, DateTimeImmutable::createFromInterface($asOf)->format('Y-m-d')]);
    return $statement->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Run the daily collection policy. It is safe to repeat: bill creation is
 * checked per resident/month, formal assessments are unique per resident/date,
 * and reminder logs have their own idempotency key.
 */
function run_dues_collection_policy(PDO $db, $runDate = null) {
    $today = dues_policy_today($runDate);
    $monthKey = dues_policy_current_month_key($today);
    $dueDate = $today->format('Y-m') . '-16';
    $summary = array(
        'run_date' => $today->format('Y-m-d'),
        'monthly_bills_generated' => 0,
        'bills_marked_overdue' => 0,
        'assessments_created' => 0,
        'hearing_reviews_flagged' => 0,
        'notifications_created' => 0,
        'reminders' => null
    );
    $newBillPushes = array();

    $typeStatement = $db->prepare("\n        SELECT payment_type_id, LOWER(TRIM(payment_name)) AS normalized_name\n        FROM payment_types\n        WHERE LOWER(TRIM(payment_name)) IN ('monthly hoa dues', 'monthly hoa dues + penalty')\n    ");
    $typeStatement->execute();
    $types = $typeStatement->fetchAll(PDO::FETCH_KEY_PAIR);
    $monthlyDuesTypeId = array_search('monthly hoa dues', $types, true);
    if (!$monthlyDuesTypeId) {
        throw new RuntimeException('Monthly HOA Dues must be available before the collection policy can run.');
    }

    // The Resolution explicitly fixes the current capstone policy at ₱325 and
    // 10%. Future configurable settings must retain this audit rule unless the
    // Board formally changes it.
    $monthlyDuesAmount = 325.00;
    $activeResidents = dues_policy_fetch_active_residents($db, $today);

    $hasMonthlyBill = $db->prepare("\n        SELECT 1\n        FROM payments p\n        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id\n        WHERE p.resident_id = ?\n          AND p.billing_month = ?\n          AND LOWER(pt.payment_name) IN ('monthly hoa dues', 'monthly hoa dues + penalty')\n        LIMIT 1\n    ");
    $createBill = $db->prepare("\n        INSERT INTO payments (resident_id, payment_type_id, billing_month, amount_due, due_date, payment_status)\n        VALUES (?, ?, ?, ?, ?, 'Pending')\n    ");
    $createNotification = $db->prepare("\n        INSERT INTO notifications (recipient_id, title, message, notification_type)\n        VALUES (?, ?, ?, 'Payment')\n    ");

    $db->beginTransaction();
    try {
        foreach ($activeResidents as $resident) {
            $hasMonthlyBill->execute([$resident['resident_id'], $monthKey]);
            if ($hasMonthlyBill->fetchColumn()) {
                continue;
            }

            $createBill->execute([$resident['resident_id'], $monthlyDuesTypeId, $monthKey, $monthlyDuesAmount, $dueDate]);
            $summary['monthly_bills_generated']++;

            if (!empty($resident['user_id'])) {
                $title = 'New monthly HOA dues bill';
                $message = 'Your Monthly HOA Dues bill of ₱325.00 is due on ' . (new DateTimeImmutable($dueDate))->format('M j, Y') . '.';
                $createNotification->execute([$resident['user_id'], $title, $message]);
                $summary['notifications_created']++;
                $newBillPushes[] = array('recipient_id' => $resident['user_id'], 'title' => $title, 'message' => $message);
            }
        }

        // A receipt awaiting officer verification is intentionally preserved as
        // Pending, not marked overdue, so a resident is not penalized while a
        // documented payment is being reviewed.
        $markOverdue = $db->prepare("\n            UPDATE payments p\n            SET payment_status = 'Overdue', updated_at = CURRENT_TIMESTAMP\n            FROM payment_types pt\n            WHERE p.payment_type_id = pt.payment_type_id\n              AND p.payment_status = 'Pending'\n              AND p.due_date < ?\n              AND LOWER(pt.payment_name) IN ('monthly hoa dues', 'monthly hoa dues + penalty')\n              AND NOT EXISTS (\n                  SELECT 1 FROM payment_receipts pr WHERE pr.payment_id = p.payment_id\n              )\n        ");
        $markOverdue->execute([$today->format('Y-m-d')]);
        $summary['bills_marked_overdue'] = $markOverdue->rowCount();

        // The first penalty is assessed on the 17th, immediately after the
        // resident has had the entire 16th to pay. A delayed daily run still
        // records the policy date as the 17th and cannot duplicate it later.
        if ((int) $today->format('d') >= 17) {
            $policyDate = new DateTimeImmutable($today->format('Y-m') . '-17', new DateTimeZone('Asia/Manila'));
            $previousPolicyDate = $policyDate->modify('-1 month');
            $createAssessment = $db->prepare("\n                INSERT INTO dues_policy_assessments\n                    (resident_id, policy_date, base_balance, previous_cycle_balance, monthly_dues_added, interest_amount,\n                     total_balance, months_overdue, collection_stage, requires_hearing)\n                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n                ON CONFLICT (resident_id, policy_date) DO NOTHING\n                RETURNING assessment_id\n            ");

            foreach ($activeResidents as $resident) {
                $rows = dues_policy_fetch_unpaid_rows($db, $resident['resident_id'], $policyDate);
                $periods = dues_policy_periods_from_rows($rows, $policyDate, false);
                $calculation = dues_policy_calculate_periods($periods, $policyDate);
                if ($calculation['months_overdue'] === 0 || $calculation['total_balance'] <= 0) {
                    continue;
                }

                $previousPeriods = dues_policy_periods_from_rows($rows, $previousPolicyDate, false);
                $previousCalculation = dues_policy_calculate_periods($previousPeriods, $previousPolicyDate);
                $currentMonthDues = 0.0;
                foreach ($rows as $row) {
                    if ((new DateTimeImmutable($row['billing_month']))->format('Y-m-01') === $monthKey) {
                        $currentMonthDues = round($currentMonthDues + (float) $row['amount_due'], 2);
                    }
                }
                $interestThisCycle = max(
                    round($calculation['total_balance'] - $previousCalculation['total_balance'] - $currentMonthDues, 2),
                    0
                );
                $stage = dues_policy_stage($calculation['months_overdue']);
                $requiresHearing = $stage === 'third_notice_hearing';

                $createAssessment->execute([
                    $resident['resident_id'],
                    $policyDate->format('Y-m-d'),
                    $calculation['base_balance'],
                    $previousCalculation['total_balance'],
                    $currentMonthDues,
                    $interestThisCycle,
                    $calculation['total_balance'],
                    $calculation['months_overdue'],
                    $stage,
                    $requiresHearing
                ]);
                if ($createAssessment->fetchColumn()) {
                    $summary['assessments_created']++;
                    if ($requiresHearing) {
                        $summary['hearing_reviews_flagged']++;
                    }
                }
            }
        }

        $db->commit();
    } catch (Exception $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $exception;
    }

    // Reminders and FCM delivery happen only after the durable changes above
    // commit. FCM is optional, while in-app notifications remain available.
    foreach ($newBillPushes as $push) {
        send_fcm_push($db, [$push['recipient_id']], $push['title'], $push['message'], 'Payment', '/my-payments');
    }
    $summary['reminders'] = run_payment_reminders($db, $today);

    return $summary;
}
?>
