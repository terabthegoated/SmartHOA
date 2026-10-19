<?php
/** Optional SQL contract check: SELECT only, guarded by PostgreSQL READ ONLY. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../helpers/dues_balances.php';
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
$env = fn($key, $fallback = null) => getenv($key) ?: ($_ENV[$key] ?? $fallback);
try {
    $dsn = 'pgsql:host=' . $env('DB_HOST', 'localhost') . ';port=' . $env('DB_PORT', '5432')
        . ';dbname=' . $env('DB_NAME', 'smarthoa_db') . ';connect_timeout=8';
    if ($env('DB_SSLMODE')) $dsn .= ';sslmode=' . $env('DB_SSLMODE');
    $db = new PDO($dsn, $env('DB_USER', 'root'), $env('DB_PASS', ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('BEGIN READ ONLY');
    $db->exec("SET LOCAL statement_timeout = '8s'");
    if ($db->query('SHOW transaction_read_only')->fetchColumn() !== 'on') throw new RuntimeException('Read-only guard missing.');
    $source = file_get_contents(__DIR__ . '/../api/officer/get_payments.php');
    if (!preg_match('/\$query\s*=\s*"([\s\S]*?)";/', $source, $matches)) throw new RuntimeException('Officer query not found.');
    $stmt = $db->query($matches[1] . ' LIMIT 1000');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $views = dues_balance_payment_views($rows);
    if (count($views) !== count($rows)) throw new RuntimeException('Payment count changed.');
    echo "PASS: officer SQL and computed balance fields work with PostgreSQL.\n";
    $user = $db->query('SELECT user_id, resident_id FROM resident_profiles LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        $source = file_get_contents(__DIR__ . '/../api/resident/get_my_payments.php');
        if (!preg_match('/\$query\s*=\s*"([\s\S]*?)";/', $source, $matches)) throw new RuntimeException('Resident query not found.');
        $stmt = $db->prepare($matches[1]); $stmt->execute([$user['user_id']]);
        $residentViews = dues_balance_payment_views($stmt->fetchAll(PDO::FETCH_ASSOC));
        echo "PASS: resident bills SQL and receipt / transaction lookups work.\n";
        $source = file_get_contents(__DIR__ . '/../api/resident/get_dues_to_pay.php');
        if (!preg_match('/\$paymentStatement\s*=\s*\$db->prepare\("([\s\S]*?)"\);/', $source, $matches)) throw new RuntimeException('Summary query not found.');
        $stmt = $db->prepare($matches[1]); $stmt->execute([$user['resident_id']]);
        $summary = dues_balance_summary(dues_balance_payment_views($stmt->fetchAll(PDO::FETCH_ASSOC)));
        $fromList = dues_balance_summary($residentViews);
        foreach (['amount_due', 'overdue_amount', 'upcoming_amount', 'under_review_amount', 'due_date', 'months_overdue'] as $key) {
            if ($summary[$key] !== $fromList[$key]) throw new RuntimeException('Bills and summary disagree.');
        }
        echo "PASS: resident dashboard equals the individual bill projections.\n";
    } else throw new RuntimeException('No resident fixture available for SQL checks.');
    $db->rollBack();
    echo "3/3 native PostgreSQL read-only checks passed; no policy run, uploads, approvals or notifications.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    // Never print credentials, personal rows or receipt URLs.
    fwrite(STDERR, 'FAIL: billing SQL contract (' . get_class($error) . ', code ' . $error->getCode() . ').' . PHP_EOL);
    exit(1);
}
