<?php
/** Existing database SQL compatibility checks. SELECTs only; never saves data. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../helpers/payment_analytics.php';
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
$env = fn($key, $fallback = null) => getenv($key) ?: ($_ENV[$key] ?? $fallback);
try {
    $dsn = 'pgsql:host=' . $env('DB_HOST', 'localhost') . ';port=' . $env('DB_PORT', '5432')
        . ';dbname=' . $env('DB_NAME', 'smarthoa_db') . ';connect_timeout=8';
    if ($env('DB_SSLMODE')) $dsn .= ';sslmode=' . $env('DB_SSLMODE');
    $db = new PDO($dsn, $env('DB_USER', 'root'), $env('DB_PASS', ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('BEGIN READ ONLY');
    $db->exec("SET LOCAL statement_timeout = '8s'");
    if ($db->query('SHOW transaction_read_only')->fetchColumn() !== 'on') throw new RuntimeException('Missing read-only guard.');
    $rows = analytics_payment_rows($db);
    $metrics = analytics_payment_metrics($rows);
    $summary = dues_balance_summary(dues_balance_payment_views($rows));
    if ($metrics['outstanding_dues'] !== $summary['amount_due'] || $metrics['overdue_amount'] !== $summary['overdue_amount']) {
        throw new RuntimeException('Analytics and bill totals disagree.');
    }
    echo "PASS: analytics SQL works and balances match the bill calculator.\n";
    $pending = $db->query("SELECT COUNT(*) FROM payments p WHERE payment_status IN ('Pending', 'Overdue')
        AND EXISTS (SELECT 1 FROM payment_receipts r WHERE r.payment_id = p.payment_id)")->fetchColumn();
    if ((int) $pending !== $metrics['pending_verifications']) throw new RuntimeException('Verification count disagrees.');
    echo "PASS: pending verification count includes overdue bills with receipts.\n";
    $source = file_get_contents(__DIR__ . '/../helpers/complaint_feedback.php');
    if (!preg_match('/\$sql\s*=\s*"([\s\S]*?)";/', $source, $match)) throw new RuntimeException('Feedback SQL not found.');
    $stmt = $db->prepare($match[1]);
    $stmt->execute(['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
    echo "PASS: corrected feedback ownership SELECT is accepted by PostgreSQL.\n";
    $source = file_get_contents(__DIR__ . '/../api/officer/get_analytics.php');
    preg_match_all('/\$db->(?:query|prepare)\("([\s\S]*?)"\)/', $source, $queries);
    $checked = 0;
    foreach ($queries[1] as $query) {
        if (!preg_match('/^\s*(SELECT|WITH)\b/i', $query)) throw new RuntimeException('Unexpected non-SELECT in endpoint SQL.');
        $db->query($query)->fetchAll(PDO::FETCH_ASSOC);
        $checked++;
    }
    if ($checked < 5) throw new RuntimeException('Analytics query coverage incomplete.');
    echo 'PASS: ', $checked, " existing community / complaint analytics SELECTs remain compatible.\n";
    $db->rollBack();
    echo "4/4 PostgreSQL read-only scenarios passed; no feedback, complaints, payments or notifications saved.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'FAIL: defense-fix SQL (' . get_class($error) . ', code ' . $error->getCode() . ').' . PHP_EOL);
    exit(1);
}
