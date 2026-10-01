<?php
/**
 * Payment reminder service.
 *
 * This file has no HTTP handling, making it safe to use from both the
 * officer-only endpoint and the daily command-line scheduler. It only creates
 * notification records. It never changes payment statuses, amounts, or access.
 */

require_once __DIR__ . '/fcm.php';

/** Return the Manila calendar date used for collection-policy checks. */
function payment_reminder_today($date = null) {
    $timezone = new DateTimeZone('Asia/Manila');

    if ($date instanceof DateTimeInterface) {
        return DateTimeImmutable::createFromInterface($date)->setTimezone($timezone)->setTime(0, 0, 0);
    }

    if (is_string($date) && trim($date) !== '') {
        try {
            return (new DateTimeImmutable($date, $timezone))->setTime(0, 0, 0);
        } catch (Exception $exception) {
            throw new InvalidArgumentException('The reminder date must be a valid date.');
        }
    }

    return (new DateTimeImmutable('today', $timezone))->setTime(0, 0, 0);
}

/** Higher values win when one resident has bills at several stages. */
function payment_reminder_stage_weight($stage) {
    $weights = array(
        'courtesy_reminder' => 1,
        'final_reminder' => 2,
        'first_notice' => 3,
        'second_notice' => 4,
        'third_notice_hearing' => 5
    );

    return $weights[$stage] ?? 0;
}

function payment_reminder_label($stage) {
    $labels = array(
        'courtesy_reminder' => 'Courtesy reminder',
        'final_reminder' => 'Final reminder',
        'first_notice' => 'First notice',
        'second_notice' => 'Second notice – demand letter',
        'third_notice_hearing' => 'Third notice – hearing review'
    );

    return $labels[$stage] ?? 'Payment reminder';
}

/**
 * Return the scheduled stage for one bill. Courtesy/final reminders are exact
 * date only, so an interrupted daily task never sends them late. Formal stages
 * catch up after a missed daily task by returning the highest applicable stage.
 *
 * `effective_date` is the original policy trigger date (not the date a delayed
 * scheduler happened to run). It is used by the idempotency log.
 */
function payment_reminder_stage_for_due_date($dueDate, DateTimeInterface $today) {
    if (!$dueDate) {
        return null;
    }

    try {
        $timezone = new DateTimeZone('Asia/Manila');
        $due = (new DateTimeImmutable((string) $dueDate, $timezone))->setTime(0, 0, 0);
        $runDate = DateTimeImmutable::createFromInterface($today)->setTimezone($timezone)->setTime(0, 0, 0);
    } catch (Exception $exception) {
        return null;
    }

    $courtesy = $due->modify('-7 days');
    $final = $due->modify('-1 day');
    $firstNotice = $due->modify('+1 day');
    $secondNotice = $due->modify('+1 month +1 day');
    $thirdNotice = $due->modify('+2 months +1 day');
    $todayString = $runDate->format('Y-m-d');

    if ($todayString === $courtesy->format('Y-m-d')) {
        return array('stage' => 'courtesy_reminder', 'effective_date' => $courtesy->format('Y-m-d'));
    }
    if ($todayString === $final->format('Y-m-d')) {
        return array('stage' => 'final_reminder', 'effective_date' => $final->format('Y-m-d'));
    }

    // Formal notices are due after the stated collection milestone. When a
    // scheduler was missed, only the most serious missed stage is eligible.
    if ($runDate >= $thirdNotice) {
        return array('stage' => 'third_notice_hearing', 'effective_date' => $thirdNotice->format('Y-m-d'));
    }
    if ($runDate >= $secondNotice) {
        return array('stage' => 'second_notice', 'effective_date' => $secondNotice->format('Y-m-d'));
    }
    if ($runDate >= $firstNotice) {
        return array('stage' => 'first_notice', 'effective_date' => $firstNotice->format('Y-m-d'));
    }

    return null;
}

/**
 * Build resident-facing text. Formal notices never quote a single bill amount:
 * outstanding balance may include several bills and compounding interest, so
 * residents are directed to the live balance in My Payments instead.
 */
function payment_reminder_content($stage, $dueDate) {
    $formattedDueDate = '';
    try {
        $formattedDueDate = (new DateTimeImmutable((string) $dueDate, new DateTimeZone('Asia/Manila')))->format('M j, Y');
    } catch (Exception $exception) {
        $formattedDueDate = (string) $dueDate;
    }

    $content = array(
        'courtesy_reminder' => array(
            'Courtesy reminder: HOA dues due soon',
            'Your HOA dues are due on ' . $formattedDueDate . '. Please review My Payments and pay on or before the due date to avoid the 10% compounding-interest policy.'
        ),
        'final_reminder' => array(
            'Final reminder: HOA dues due tomorrow',
            'Your HOA dues are due tomorrow (' . $formattedDueDate . '). Please review My Payments and submit payment on or before the due date.'
        ),
        'first_notice' => array(
            'First notice: HOA dues overdue',
            'Your HOA dues remain unpaid after the due date. Please review your current balance in My Payments and arrange payment. The 10% compounding-interest policy applies to outstanding balances every 16th.'
        ),
        'second_notice' => array(
            'Second notice: payment follow-up',
            'Your HOA dues remain unpaid into the next monthly collection cycle. Please review your current balance in My Payments and settle it or contact the HOA office to avoid further collection action.'
        ),
        'third_notice_hearing' => array(
            'Third notice: hearing review required',
            'Your HOA dues remain unpaid for two monthly collection cycles. Your account requires HOA/Grievance Committee hearing review. Please review My Payments or contact the HOA office. This notice does not freeze your account or change your payment status.'
        )
    );

    return $content[$stage] ?? array('Payment reminder', 'Please review your unpaid HOA dues in My Payments.');
}

/**
 * Create in-app reminders for the policy stages that are eligible today.
 *
 * The idempotency key is recipient + stage + effective policy date. This keeps
 * delayed daily jobs from repeating a notice while still preserving a durable
 * audit trail. Multiple bills for one resident result in one notification in a
 * run; the highest eligible stage wins. Bills with submitted payment receipts
 * are excluded so a resident awaiting verification is not treated as delinquent.
 *
 * @return array Summary suitable for an officer screen or scheduler log.
 */
function run_payment_reminders(PDO $db, $runDate = null) {
    $today = payment_reminder_today($runDate);
    $summary = array(
        'run_date' => $today->format('Y-m-d'),
        'eligible' => 0,
        'sent' => 0,
        'already_sent' => 0,
        'skipped' => 0,
        'by_stage' => array(
            'courtesy_reminder' => 0,
            'final_reminder' => 0,
            'first_notice' => 0,
            'second_notice' => 0,
            'third_notice_hearing' => 0
        )
    );

    // Reminders work only from real, generated bills. This intentionally does
    // not manufacture a virtual monthly charge for a resident who has no bill.
    $payments = $db->prepare("
        SELECT
            p.payment_id,
            p.due_date,
            rp.user_id AS recipient_user_id
        FROM payments p
        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
        INNER JOIN resident_profiles rp ON rp.resident_id = p.resident_id
        WHERE p.payment_status IN ('Pending', 'Overdue')
          AND p.due_date IS NOT NULL
          AND LOWER(pt.payment_name) IN ('monthly hoa dues', 'monthly hoa dues + penalty')
          AND rp.user_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM payment_receipts pr
              WHERE pr.payment_id = p.payment_id
          )
        ORDER BY p.due_date ASC, p.payment_id ASC
    ");
    $payments->execute();

    $wasSent = $db->prepare("
        SELECT 1
        FROM payment_reminder_logs
        WHERE recipient_id = ?
          AND reminder_stage = ?
          AND scheduled_for = ?
        LIMIT 1
    ");
    $candidates = array();

    foreach ($payments->fetchAll(PDO::FETCH_ASSOC) as $payment) {
        $stageInfo = payment_reminder_stage_for_due_date($payment['due_date'], $today);
        if ($stageInfo === null) {
            $summary['skipped']++;
            continue;
        }

        $recipientId = (string) $payment['recipient_user_id'];
        $wasSent->execute(array($recipientId, $stageInfo['stage'], $stageInfo['effective_date']));
        if ($wasSent->fetchColumn()) {
            $summary['already_sent']++;
            continue;
        }

        if (!isset($candidates[$recipientId]) || payment_reminder_stage_weight($stageInfo['stage']) > payment_reminder_stage_weight($candidates[$recipientId]['stage'])) {
            $candidates[$recipientId] = array(
                'recipient_id' => $recipientId,
                'payment_id' => $payment['payment_id'],
                'due_date' => $payment['due_date'],
                'stage' => $stageInfo['stage'],
                'effective_date' => $stageInfo['effective_date']
            );
        }
    }

    $createLog = $db->prepare("
        INSERT INTO payment_reminder_logs (payment_id, recipient_id, reminder_stage, scheduled_for)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (recipient_id, reminder_stage, scheduled_for) DO NOTHING
        RETURNING reminder_log_id
    ");
    $createNotification = $db->prepare("
        INSERT INTO notifications (recipient_id, title, message, notification_type)
        VALUES (?, ?, ?, 'Payment')
        RETURNING notification_id
    ");
    $linkNotification = $db->prepare("
        UPDATE payment_reminder_logs
        SET notification_id = ?
        WHERE reminder_log_id = ?
    ");

    foreach ($candidates as $candidate) {
        $summary['eligible']++;

        try {
            $db->beginTransaction();
            $createLog->execute(array(
                $candidate['payment_id'],
                $candidate['recipient_id'],
                $candidate['stage'],
                $candidate['effective_date']
            ));
            $reminderLogId = $createLog->fetchColumn();

            if (!$reminderLogId) {
                $db->rollBack();
                $summary['already_sent']++;
                continue;
            }

            list($title, $message) = payment_reminder_content($candidate['stage'], $candidate['due_date']);
            $createNotification->execute(array($candidate['recipient_id'], $title, $message));
            $notificationId = $createNotification->fetchColumn();
            if (!$notificationId) {
                throw new RuntimeException('Could not create the in-app payment reminder.');
            }

            $linkNotification->execute(array($notificationId, $reminderLogId));
            $db->commit();

            $summary['sent']++;
            $summary['by_stage'][$candidate['stage']]++;

            // FCM is optional and is deliberately sent after durable records
            // commit. fcm.php handles absent configuration/network failures.
            send_fcm_push(
                $db,
                array($candidate['recipient_id']),
                $title,
                $message,
                'Payment',
                '/my-payments'
            );
        } catch (Exception $exception) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('SmartHOA payment reminder skipped for recipient ' . $candidate['recipient_id'] . ': ' . $exception->getMessage());
            $summary['skipped']++;
        }
    }

    return $summary;
}
