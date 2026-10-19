<?php
/** CLI-only synthetic tests. No .env, network, notifications or production data. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../helpers/bill_billing_month.php';
require_once __DIR__ . '/../helpers/payment_settlement.php';

function period_assert($actual, $expected) {
    if ($actual !== $expected) throw new RuntimeException('Expected ' . json_encode($expected) . ', got ' . json_encode($actual));
}
function period_fixture($status = 'Pending', $type = 'dues', $month = '2026-10-01', $resident = 'resident') {
    $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec("CREATE TABLE resident_profiles (resident_id TEXT PRIMARY KEY);
        INSERT INTO resident_profiles VALUES ('resident'), ('other');
        CREATE TABLE payment_types (payment_type_id TEXT, payment_name TEXT);
        INSERT INTO payment_types VALUES ('dues', 'Monthly HOA Dues'), ('penalty', 'Monthly HOA Dues + Penalty'), ('fee', 'Car Sticker');
        CREATE TABLE payments (payment_id TEXT PRIMARY KEY, resident_id TEXT, payment_type_id TEXT, billing_month TEXT,
            due_date TEXT, amount_due NUMERIC, payment_status TEXT);");
    $db->prepare("INSERT INTO payments VALUES ('old', ?, ?, ?, '2026-10-16', 325, ?)")->execute([$resident, $type, $month, $status]);
    return $db;
}
function period_due($date) { return new DateTimeImmutable($date, new DateTimeZone('Asia/Manila')); }

$tests = [
    'older clients infer November from November 16, not the creation month' => function () {
        period_assert(bill_billing_month('', period_due('2026-11-16')), '2026-11-01');
        period_assert(bill_billing_month(null, period_due('2026-11-16')), '2026-11-01');
    },
    'year transition infers January of the following year' => function () {
        period_assert(bill_billing_month('', period_due('2027-01-16')), '2027-01-01');
    },
    'explicit October period is preserved with a November deadline' => function () {
        period_assert(bill_billing_month('2026-10', period_due('2026-11-16')), '2026-10-01');
    },
    'valid full dates and month-only inputs normalize to first day' => function () {
        foreach (['2026-11', '2026-11-01', '2026-11-30', ' 2026-11 '] as $input) {
            period_assert(bill_billing_month($input, period_due('2026-10-16')), '2026-11-01');
        }
        period_assert(bill_billing_month('2028-02-29', period_due('2028-03-16')), '2028-02-01');
    },
    'malformed months and invalid calendar dates are rejected' => function () {
        foreach (['2026-13', '2026-00', '2026-1', '0000-01', '2026-02-29', '2026-11-31', '2026-11-00', '2026-11-01extra'] as $input) {
            try { bill_billing_month($input, period_due('2026-11-16')); }
            catch (InvalidArgumentException $error) { continue; }
            throw new RuntimeException('Invalid period was accepted: ' . $input);
        }
    },
    'October unpaid, overdue and paid bills do not block November' => function () {
        foreach (['Pending', 'Overdue', 'Paid'] as $status) {
            $db = period_fixture($status);
            period_assert(dues_balance_monthly_bill_exists($db, 'resident', '2026-11-01'), false);
            period_assert(dues_balance_monthly_bill_exists($db, 'resident', '2026-10-01'), true);
        }
    },
    'an existing November bill blocks another November even when paid' => function () {
        foreach (['Pending', 'Overdue', 'Paid'] as $status) {
            foreach (['dues', 'penalty'] as $type) {
                period_assert(dues_balance_monthly_bill_exists(period_fixture($status, $type, '2026-11-01'), 'resident', '2026-11-01'), true);
            }
        }
    },
    'different due dates do not bypass the same-period duplicate guard' => function () {
        $db = period_fixture('Pending', 'dues', '2026-11-01');
        foreach (['2026-11-16', '2026-11-20', '2026-12-16'] as $deadline) {
            $month = bill_billing_month('2026-11', period_due($deadline));
            period_assert(dues_balance_monthly_bill_exists($db, 'resident', $month), true);
        }
    },
    'cancelled bills and unrelated fees do not block a monthly bill' => function () {
        period_assert(dues_balance_monthly_bill_exists(period_fixture('Cancelled', 'dues', '2026-11-01'), 'resident', '2026-11-01'), false);
        period_assert(dues_balance_monthly_bill_exists(period_fixture('Pending', 'fee', '2026-11-01'), 'resident', '2026-11-01'), false);
    },
    'a different resident does not block the selected resident' => function () {
        period_assert(dues_balance_monthly_bill_exists(period_fixture('Pending', 'dues', '2026-11-01', 'other'), 'resident', '2026-11-01'), false);
    },
    'synthetic next-month creation preserves history and blocks a repeat' => function () {
        $db = period_fixture('Paid');
        $old = $db->query('SELECT * FROM payments')->fetchAll(PDO::FETCH_ASSOC);
        $month = bill_billing_month('', period_due('2026-11-16'));
        $db->beginTransaction();
        dues_balance_lock_resident($db, 'resident');
        period_assert(dues_balance_monthly_bill_exists($db, 'resident', $month), false);
        $db->prepare("INSERT INTO payments VALUES ('new', 'resident', 'dues', ?, '2026-11-16', 325, 'Pending')")->execute([$month]);
        $db->commit();
        period_assert($db->query("SELECT * FROM payments WHERE payment_id = 'old'")->fetchAll(PDO::FETCH_ASSOC), $old);
        period_assert($db->query("SELECT billing_month FROM payments WHERE payment_id = 'new'")->fetchColumn(), '2026-11-01');
        period_assert(dues_balance_monthly_bill_exists($db, 'resident', $month), true);
        period_assert((int) $db->query('SELECT COUNT(*) FROM payments')->fetchColumn(), 2);
    },
];

foreach ($tests as $name => $test) { $test(); echo 'PASS: ' . $name . PHP_EOL; }
echo count($tests) . '/' . count($tests) . ' billing-period checks passed; synthetic data only.' . PHP_EOL;
