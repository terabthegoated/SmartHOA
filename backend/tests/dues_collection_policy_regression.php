<?php
/**
 * Run: php backend/tests/dues_collection_policy_regression.php
 * Uses only SQLite :memory: fixtures, never loads .env, and disables push.
 * A strict hearing-flag CHECK rejects the empty string PostgreSQL rejects
 * when PHP false is supplied as an untyped execute([...]) parameter.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
foreach (['FCM_SERVICE_ACCOUNT_BASE64', 'FCM_SERVICE_ACCOUNT_PATH', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as $key) {
    putenv($key . '=');
    $_ENV[$key] = '';
}
require_once __DIR__ . '/../helpers/dues_collection_policy.php';

function policy_test_assert($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

class PolicyTestPDO extends PDO {
    public function prepare(string $query, array $options = []): PDOStatement|false {
        // SQLite requires AS for this alias; PostgreSQL allows the original.
        $query = str_replace('UPDATE payments p', 'UPDATE payments AS p', $query);
        return parent::prepare($query, $options);
    }
}

class PolicyTestStatement extends PDOStatement {
    public function fetchColumn(int $column = 0): mixed {
        $value = parent::fetchColumn($column);
        // Unlike PostgreSQL, SQLite holds a write lock until RETURNING closes.
        if (stripos($this->queryString, 'RETURNING') !== false) {
            $this->closeCursor();
        }
        return $value;
    }
}

function policy_test_database() {
    $db = new PolicyTestPDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->setAttribute(PDO::ATTR_STATEMENT_CLASS, [PolicyTestStatement::class]);
    $db->exec(<<<'SQL'
        CREATE TABLE payment_types (payment_type_id TEXT PRIMARY KEY, payment_name TEXT);
        INSERT INTO payment_types VALUES ('monthly-dues', 'Monthly HOA Dues');
        CREATE TABLE properties (property_id TEXT PRIMARY KEY, property_status TEXT);
        CREATE TABLE resident_profiles (
            resident_id TEXT PRIMARY KEY, user_id TEXT, property_id TEXT,
            resident_status TEXT, move_in_date TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE payments (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT, resident_id TEXT, payment_type_id TEXT,
            billing_month TEXT, amount_due NUMERIC, due_date TEXT, payment_status TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE payment_receipts (payment_id INTEGER);
        CREATE TABLE notifications (
            notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_id TEXT, title TEXT, message TEXT, notification_type TEXT
        );
        CREATE TABLE payment_reminder_logs (
            reminder_log_id INTEGER PRIMARY KEY AUTOINCREMENT, payment_id INTEGER,
            recipient_id TEXT, reminder_stage TEXT, scheduled_for TEXT, notification_id INTEGER,
            UNIQUE (recipient_id, reminder_stage, scheduled_for)
        );
        CREATE TABLE dues_policy_assessments (
            assessment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id TEXT, policy_date TEXT, base_balance NUMERIC,
            previous_cycle_balance NUMERIC, monthly_dues_added NUMERIC, interest_amount NUMERIC,
            total_balance NUMERIC, months_overdue INTEGER, collection_stage TEXT,
            requires_hearing INTEGER NOT NULL CHECK (
                typeof(requires_hearing) = 'integer' AND requires_hearing IN (0, 1)
            ),
            UNIQUE (resident_id, policy_date)
        );
    SQL);
    return $db;
}

function policy_test_resident(PDO $db, $residentId, $months, $withReceipt = false) {
    $db->prepare("INSERT INTO properties VALUES (?, 'Occupied')")->execute([$residentId]);
    $db->prepare("INSERT INTO resident_profiles (resident_id, user_id, property_id, resident_status) VALUES (?, ?, ?, 'Active')")
        ->execute([$residentId, 'user-' . $residentId, $residentId]);
    $insert = $db->prepare("INSERT INTO payments (resident_id, payment_type_id, billing_month, amount_due, due_date, payment_status) VALUES (?, 'monthly-dues', ?, 325, ?, 'Pending')");
    foreach ($months as $month) {
        $insert->execute([$residentId, $month . '-01', $month . '-16']);
        if ($withReceipt) {
            $db->prepare('INSERT INTO payment_receipts VALUES (?)')->execute([$db->lastInsertId()]);
        }
    }
}

$tests = [
    'first notice stores false without a boolean error' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'first', ['2026-10']);
        $summary = run_dues_collection_policy($db, '2026-10-17');
        $row = $db->query('SELECT * FROM dues_policy_assessments')->fetch(PDO::FETCH_ASSOC);
        policy_test_assert($summary['assessments_created'] === 1, 'First assessment was not created.');
        policy_test_assert($row['collection_stage'] === 'first_notice' && (int) $row['requires_hearing'] === 0, 'Wrong first-notice stage or flag.');
        policy_test_assert((float) $row['total_balance'] === 357.50, 'First-notice balance changed.');
    },
    'second notice stores false and preserves compounding' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'second', ['2026-09', '2026-10']);
        run_dues_collection_policy($db, '2026-10-17');
        $row = $db->query('SELECT * FROM dues_policy_assessments')->fetch(PDO::FETCH_ASSOC);
        policy_test_assert($row['collection_stage'] === 'second_notice' && (int) $row['requires_hearing'] === 0, 'Wrong second-notice stage or flag.');
        policy_test_assert((float) $row['total_balance'] === 750.75, 'Second-notice balance changed.');
    },
    'third notice stores true and flags officer review without suspension' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'third', ['2026-08', '2026-09', '2026-10']);
        $summary = run_dues_collection_policy($db, '2026-10-17');
        $row = $db->query('SELECT * FROM dues_policy_assessments')->fetch(PDO::FETCH_ASSOC);
        policy_test_assert($summary['hearing_reviews_flagged'] === 1, 'Hearing review was not counted.');
        policy_test_assert($row['collection_stage'] === 'third_notice_hearing' && (int) $row['requires_hearing'] === 1, 'Wrong third-notice stage or flag.');
        policy_test_assert((float) $row['total_balance'] === 1183.33, 'Third-notice balance changed.');
        policy_test_assert($db->query('SELECT resident_status FROM resident_profiles')->fetchColumn() === 'Active', 'Resident was suspended.');
    },
    'mixed stages rebind the hearing flag for every resident' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'mixed-first', ['2026-10']);
        policy_test_resident($db, 'mixed-third', ['2026-08', '2026-09', '2026-10']);
        policy_test_resident($db, 'mixed-second', ['2026-09', '2026-10']);
        $summary = run_dues_collection_policy($db, '2026-10-17');
        $flags = $db->query('SELECT resident_id, requires_hearing FROM dues_policy_assessments')->fetchAll(PDO::FETCH_KEY_PAIR);
        policy_test_assert($summary['assessments_created'] === 3, 'Mixed assessments were not created.');
        policy_test_assert((int) $flags['mixed-first'] === 0 && (int) $flags['mixed-third'] === 1 && (int) $flags['mixed-second'] === 0, 'Flag leaked between residents.');
    },
    'repeat and delayed runs do not duplicate assessments or notices' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'repeat', ['2026-10']);
        run_dues_collection_policy($db, '2026-10-17');
        $count = (int) $db->query('SELECT COUNT(*) FROM notifications')->fetchColumn();
        foreach (['2026-10-17', '2026-10-20'] as $date) {
            $summary = run_dues_collection_policy($db, $date);
            policy_test_assert($summary['assessments_created'] === 0, 'Duplicate assessment.');
            policy_test_assert($summary['monthly_bills_generated'] === 0, 'Duplicate bill.');
            policy_test_assert($summary['reminders']['sent'] === 0, 'Duplicate reminder.');
        }
        policy_test_assert((int) $db->query('SELECT COUNT(*) FROM dues_policy_assessments')->fetchColumn() === 1, 'Duplicate monthly assessment.');
        policy_test_assert((int) $db->query('SELECT COUNT(*) FROM notifications')->fetchColumn() === $count, 'Duplicate notifications.');
    },
    'the 16th remains payable without an assessment' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'on-time', ['2026-10']);
        $summary = run_dues_collection_policy($db, '2026-10-16');
        policy_test_assert($summary['assessments_created'] === 0 && $summary['bills_marked_overdue'] === 0, 'Resident penalized on the due date.');
    },
    'submitted receipts are excluded from overdue assessment and reminders' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'receipt', ['2026-10'], true);
        $summary = run_dues_collection_policy($db, '2026-10-17');
        policy_test_assert($summary['assessments_created'] === 0 && $summary['bills_marked_overdue'] === 0, 'Pending receipt penalized.');
        policy_test_assert($summary['reminders']['sent'] === 0, 'Pending receipt received delinquency notice.');
    },
    'monthly bill generation retains the existing amount and due date' => function () {
        $db = policy_test_database();
        policy_test_resident($db, 'new-bill', []);
        $summary = run_dues_collection_policy($db, '2026-10-17');
        $bill = $db->query('SELECT * FROM payments')->fetch(PDO::FETCH_ASSOC);
        policy_test_assert($summary['monthly_bills_generated'] === 1, 'Monthly bill not generated.');
        policy_test_assert((float) $bill['amount_due'] === 325.00 && $bill['due_date'] === '2026-10-16', 'Bill amount or due date changed.');
        policy_test_assert($summary['assessments_created'] === 1, 'New bill not assessed after the due date.');
    },
];
$passed = 0;
foreach ($tests as $name => $test) {
    try {
        $test();
        $passed++;
        echo 'PASS: ', $name, PHP_EOL;
    } catch (Throwable $exception) {
        fwrite(STDERR, 'FAIL: ' . $name . ': ' . $exception->getMessage() . PHP_EOL);
        exit(1);
    }
}
echo $passed, '/', count($tests), ' isolated regression scenarios passed.', PHP_EOL;
