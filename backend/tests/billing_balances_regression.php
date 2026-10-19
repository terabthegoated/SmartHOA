<?php
/** CLI-only synthetic tests. No .env, network calls or production database. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../helpers/dues_collection_policy.php';

function bill_fixture($id, $due, $status = 'Pending', $receipt = null, $amount = 325) {
    return ['payment_id' => $id, 'resident_id' => 'resident', 'billing_month' => substr($due, 0, 7) . '-01',
        'due_date' => $due, 'amount_due' => $amount, 'payment_status' => $status,
        'type_name' => 'Monthly HOA Dues', 'receipt_submitted_at' => $receipt];
}
function check_value($actual, $expected, $label) {
    if ((is_int($actual) || is_float($actual)) && (is_int($expected) || is_float($expected)) && (float) $actual === (float) $expected) return;
    if ($actual !== $expected) throw new RuntimeException($label . ': expected ' . json_encode($expected) . ', got ' . json_encode($actual));
}
function bill_test_db($receipt = true, $status = 'Pending') {
    $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec("CREATE TABLE resident_profiles (resident_id TEXT PRIMARY KEY, user_id TEXT);
        INSERT INTO resident_profiles VALUES ('resident', 'user');
        CREATE TABLE payment_types (payment_type_id TEXT, payment_name TEXT);
        INSERT INTO payment_types VALUES ('dues', 'Monthly HOA Dues'), ('penalty', 'Monthly HOA Dues + Penalty'), ('fee', 'Car Sticker');
        CREATE TABLE payments (payment_id TEXT PRIMARY KEY, resident_id TEXT, payment_type_id TEXT, billing_month TEXT,
            due_date TEXT, amount_due NUMERIC, payment_status TEXT, updated_at TEXT);
        CREATE TABLE payment_receipts (payment_id TEXT, uploaded_at TEXT);
        CREATE TABLE payment_transactions (payment_id TEXT, amount_paid NUMERIC, payment_date TEXT, approved_by TEXT, remarks TEXT);
        CREATE TABLE notifications (recipient_id TEXT, title TEXT, message TEXT, notification_type TEXT);");
    $db->prepare("INSERT INTO payments VALUES ('bill', 'resident', 'dues', '2026-10-01', '2026-10-16', 325, ?, NULL)")->execute([$status]);
    if ($receipt) $db->exec("INSERT INTO payment_receipts VALUES ('bill', '2026-10-18T10:00:00+08:00')");
    return $db;
}
function must_reject($callback, $label) {
    try { $callback(); } catch (RuntimeException $error) {
        check_value($error->getCode(), 409, $label . ' code');
        return;
    }
    throw new RuntimeException($label . ' was not rejected');
}

$tests = [
    'Board reference balances remain 357.50, 750.75 and 1183.33' => function () {
        foreach ([1 => 357.50, 2 => 750.75, 3 => 1183.33] as $count => $expected) {
            $rows = [];
            for ($m = 11 - $count; $m <= 10; $m++) $rows[] = bill_fixture((string) $m, sprintf('2026-%02d-16', $m));
            $views = dues_balance_payment_views($rows, '2026-10-17');
            $sum = dues_balance_summary($views, '2026-10-17');
            check_value($sum['amount_due'], $expected, 'Board total');
            check_value($sum['months_overdue'], $count, 'Board stage');
            $calc = dues_policy_calculate_periods(dues_policy_periods_from_rows($rows, dues_policy_today('2026-10-17')), dues_policy_today('2026-10-17'));
            check_value($calc['total_balance'], $sum['amount_due'], 'engine/dashboard parity');
        }
    },
    'reported October screenshot separates overdue and upcoming bills' => function () {
        $rows = [bill_fixture('old', '2026-10-16'), bill_fixture('paid', '2026-10-16', 'Paid'), bill_fixture('new', '2026-10-20')];
        $summary = dues_balance_summary(dues_balance_payment_views($rows, '2026-10-19'), '2026-10-19');
        foreach (['amount_due' => 682.50, 'overdue_amount' => 357.50, 'upcoming_amount' => 325.0,
            'penalty_amount' => 32.50, 'due_date' => '2026-10-16', 'months_overdue' => 1] as $key => $value) check_value($summary[$key], $value, $key);
    },
    'two October due dates do not become two overdue months' => function () {
        $rows = [bill_fixture('old', '2026-10-16'), bill_fixture('new', '2026-10-20')];
        $summary = dues_balance_summary(dues_balance_payment_views($rows, '2026-10-21'), '2026-10-21');
        check_value($summary['amount_due'], 715.0, 'same-month total');
        check_value($summary['months_overdue'], 1, 'same-month notice');
    },
    'missing monthly bills do not stop interest or invent new principal' => function () {
        $views = dues_balance_payment_views([bill_fixture('aug', '2026-08-16')], '2026-10-17');
        check_value($views[0]['balance_due'], 432.58, 'three cycles');
        check_value($views[0]['principal_amount'], 325.0, 'original principal');
        check_value($views[0]['months_overdue'], 3, 'elapsed cycles');
    },
    'due date is payable and interest does not increase every day' => function () {
        $rows = [bill_fixture('bill', '2026-10-16')];
        check_value(dues_balance_payment_views($rows, '2026-10-16')[0]['balance_due'], 325.0, 'due day');
        foreach (['2026-10-17', '2026-10-19', '2026-11-16'] as $date) check_value(dues_balance_payment_views($rows, $date)[0]['balance_due'], 357.50, $date);
        check_value(dues_balance_payment_views($rows, '2026-11-17')[0]['balance_due'], 393.25, 'next cycle');
    },
    'receipt submitted on time stays at principal while under review' => function () {
        $views = dues_balance_payment_views([bill_fixture('bill', '2026-10-16', 'Overdue', '2026-10-16T23:59:00+08:00')], '2026-11-20');
        check_value($views[0]['balance_due'], 325.0, 'receipt hold');
        $summary = dues_balance_summary($views, '2026-11-20');
        check_value($summary['status'], 'Under review', 'review status');
        check_value($summary['amount_due'], 0.0, 'not demanded twice');
        check_value($summary['under_review_amount'], 325.0, 'under-review breakdown');
    },
    'late receipt retains accrued interest but no additional review-time interest' => function () {
        $view = dues_balance_payment_views([bill_fixture('bill', '2026-10-16', 'Overdue', '2026-10-18T10:00:00+08:00')], '2026-12-20')[0];
        check_value($view['balance_due'], 357.50, 'late receipt hold');
        check_value($view['balance_as_of'], '2026-10-18', 'hold date');
    },
    'UTC upload timestamps use the Philippine calendar' => function () {
        $view = dues_balance_payment_views([bill_fixture('bill', '2026-10-16', 'Pending', '2026-10-16T16:01:00+00:00')], '2026-10-19')[0];
        check_value($view['balance_due'], 357.50, 'Manila 17th');
    },
    'paid and cancelled histories are not recalculated' => function () {
        $paid = bill_fixture('paid', '2026-01-16', 'Paid');
        $paid['recorded_paid_amount'] = '357.50';
        $views = dues_balance_payment_views([$paid, bill_fixture('cancelled', '2026-01-16', 'Cancelled')], '2026-10-19');
        check_value($views[0]['amount_due'], 325, 'stored bill unchanged');
        check_value($views[0]['balance_due'], 357.50, 'recorded paid amount');
        check_value($views[1]['interest_amount'], 0.0, 'cancelled interest');
        check_value(dues_balance_summary($views, '2026-10-19')['amount_due'], 0.0, 'settled excluded');
    },
    'non-HOA fees do not receive HOA compound interest' => function () {
        $row = bill_fixture('fee', '2026-01-01'); $row['type_name'] = 'Car Sticker';
        $view = dues_balance_payment_views([$row], '2026-10-19')[0];
        check_value($view['balance_due'], 325.0, 'other fee');
        check_value($view['interest_amount'], 0.0, 'other fee interest');
    },
    'cent allocation matches total rounding and is stable across row order' => function () {
        $rows = [bill_fixture('a', '2026-10-16', 'Pending', null, 0.05), bill_fixture('b', '2026-10-16', 'Pending', null, 0.05)];
        $views = dues_balance_payment_views($rows, '2026-10-17');
        check_value(round(array_sum(array_column($views, 'balance_due')), 2), 0.11, 'account rounded once');
        $reverse = dues_balance_payment_views(array_reverse($rows), '2026-10-17');
        check_value($views[0]['balance_due'], $reverse[1]['balance_due'], 'stable allocation');
    },
    'different residents never share a rounding allocation' => function () {
        $rows = [bill_fixture('a', '2026-10-16', 'Pending', null, 0.05), bill_fixture('b', '2026-10-16', 'Pending', null, 0.05)];
        $rows[1]['resident_id'] = 'other';
        check_value(round(array_sum(array_column(dues_balance_payment_views($rows, '2026-10-17'), 'balance_due')), 2), 0.12, 'separate accounts');
    },
    'month-end and leap-year due dates never compound twice in one month' => function () {
        foreach (['2026-01-31' => ['2026-02-17', '2026-03-17'], '2024-02-29' => ['2024-03-17', '2024-04-17']] as $due => $dates) {
            $rows = [bill_fixture('bill', $due)];
            check_value(dues_balance_payment_views($rows, $dates[0])[0]['balance_due'], 357.50, 'first cycle');
            check_value(dues_balance_payment_views($rows, $dates[1])[0]['balance_due'], 393.25, 'second cycle');
        }
    },
    'custom-date reminder stages agree with the balance cycles' => function () {
        foreach (['2026-10-20', '2026-01-31'] as $due) {
            foreach ([1 => 'first_notice', 2 => 'second_notice', 3 => 'third_notice_hearing'] as $cycle => $stage) {
                $date = dues_balance_notice_date($due, $cycle);
                check_value(payment_reminder_stage_for_due_date($due, $date)['stage'], $stage, 'notice stage');
                check_value(dues_balance_payment_views([bill_fixture('bill', $due)], $date)[0]['months_overdue'], $cycle, 'cycle count');
            }
        }
    },
    'future bills remain unpaid, not overdue or interest-bearing' => function () {
        $view = dues_balance_payment_views([bill_fixture('future', '2026-11-16', 'Overdue')], '2026-10-19')[0];
        check_value($view['payment_status'], 'Pending', 'effective status');
        check_value($view['balance_due'], 325.0, 'future amount');
    },
    'approval records the confirmed interest-inclusive total exactly once' => function () {
        $db = bill_test_db();
        $result = approve_recorded_payment($db, 'bill', 'officer', 357.50, '2026-11-20');
        check_value($result['amount_paid'], 357.50, 'settled total');
        check_value((float) $db->query('SELECT amount_paid FROM payment_transactions')->fetchColumn(), 357.50, 'transaction');
        check_value((float) $db->query('SELECT amount_due FROM payments')->fetchColumn(), 325.0, 'original bill retained');
        check_value(approve_recorded_payment($db, 'bill', 'officer', 357.50, '2026-11-20')['already_approved'], true, 'retry idempotence');
        check_value((int) $db->query('SELECT COUNT(*) FROM payment_transactions')->fetchColumn(), 1, 'one transaction');
        check_value((int) $db->query('SELECT COUNT(*) FROM notifications')->fetchColumn(), 1, 'one notification');
    },
    'wrong total / missing confirmation cannot silently settle interest' => function () {
        foreach ([325, null, 0, 'invalid'] as $amount) {
            $db = bill_test_db();
            must_reject(fn() => approve_recorded_payment($db, 'bill', 'officer', $amount, '2026-10-19'), 'amount mismatch');
            check_value($db->query('SELECT payment_status FROM payments')->fetchColumn(), 'Pending', 'rollback status');
            check_value((int) $db->query('SELECT COUNT(*) FROM payment_transactions')->fetchColumn(), 0, 'no false transaction');
        }
    },
    'approval requires an unpaid bill and receipt' => function () {
        foreach ([[false, 'Pending'], [true, 'Cancelled'], [true, 'Failed']] as [$receipt, $status]) {
            $db = bill_test_db($receipt, $status);
            must_reject(fn() => approve_recorded_payment($db, 'bill', 'officer', 357.50, '2026-10-19'), 'unapprovable bill');
        }
    },
    'monthly duplicate guard covers both dues types and paid bills, not other fees' => function () {
        $db = bill_test_db();
        check_value(dues_balance_monthly_bill_exists($db, 'resident', '2026-10-01'), true, 'existing bill');
        $db->exec("UPDATE payments SET payment_status = 'Paid', payment_type_id = 'penalty'");
        check_value(dues_balance_monthly_bill_exists($db, 'resident', '2026-10-01'), true, 'paid penalty type');
        check_value(dues_balance_monthly_bill_exists($db, 'resident', '2026-11-01'), false, 'other month');
        $db->exec("UPDATE payments SET payment_type_id = 'fee'");
        check_value(dues_balance_monthly_bill_exists($db, 'resident', '2026-10-01'), false, 'separate fee');
        $db->exec("UPDATE payments SET payment_type_id = 'dues', payment_status = 'Cancelled'");
        check_value(dues_balance_monthly_bill_exists($db, 'resident', '2026-10-01'), false, 'cancelled bill does not block replacement');
    },
];
$passed = 0;
foreach ($tests as $name => $test) {
    try { $test(); echo 'PASS: ', $name, PHP_EOL; $passed++; }
    catch (Throwable $error) { fwrite(STDERR, 'FAIL: ' . $name . ': ' . $error->getMessage() . PHP_EOL); exit(1); }
}
echo $passed, '/', count($tests), ' isolated billing regression scenarios passed.', PHP_EOL;
