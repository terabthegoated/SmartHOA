<?php
/**
 * Optional native PostgreSQL regression check, using backend connection config.
 * Run: php backend/tests/dues_policy_boolean_postgres_readonly.php
 * Executes SELECTs only, inside BEGIN READ ONLY. Never runs the policy.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../vendor/autoload.php';
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
$env = static function ($key, $fallback = null) {
    return getenv($key) ?: ($_ENV[$key] ?? $fallback);
};
$dsn = 'pgsql:host=' . $env('DB_HOST', 'localhost')
    . ';port=' . $env('DB_PORT', '5432')
    . ';dbname=' . $env('DB_NAME', 'smarthoa_db') . ';connect_timeout=8';
if ($env('DB_SSLMODE')) {
    $dsn .= ';sslmode=' . $env('DB_SSLMODE');
}
try {
    $db = new PDO($dsn, $env('DB_USER', 'root'), $env('DB_PASS', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec('BEGIN READ ONLY');
    $db->exec("SET LOCAL statement_timeout = '8s'");
    if ($db->query('SHOW transaction_read_only')->fetchColumn() !== 'on') {
        throw new RuntimeException('Read-only transaction was not enabled.');
    }

    // Reproduce the original false-as-empty-string failure without an INSERT.
    $db->exec('SAVEPOINT legacy_binding');
    $reproduced = false;
    try {
        $db->prepare('SELECT CAST(? AS BOOLEAN)')->execute([false]);
    } catch (PDOException $exception) {
        $reproduced = $exception->getCode() === '22P02';
        $db->exec('ROLLBACK TO SAVEPOINT legacy_binding');
    }
    $db->exec('RELEASE SAVEPOINT legacy_binding');
    if (!$reproduced) {
        throw new RuntimeException('The original boolean-binding failure was not reproduced.');
    }
    echo "PASS: original untyped false reproduces PostgreSQL 22P02 (SELECT only).\n";

    // Match the assessment's parameter positions and types, using only literals.
    $statement = $db->prepare('SELECT CAST(? AS UUID), CAST(? AS DATE), CAST(? AS NUMERIC), CAST(? AS NUMERIC), CAST(? AS NUMERIC), CAST(? AS NUMERIC), CAST(? AS NUMERIC), CAST(? AS SMALLINT), CAST(? AS TEXT), CAST(? AS BOOLEAN) AS requires_hearing');
    foreach ([false, true, false] as $requiresHearing) {
        $values = ['00000000-0000-0000-0000-000000000001', '2026-10-17', 325, 0, 325, 32.5, 357.5, 1, 'first_notice'];
        foreach ($values as $index => $value) {
            $statement->bindValue($index + 1, $value);
        }
        $statement->bindValue(10, $requiresHearing, PDO::PARAM_BOOL);
        $statement->execute();
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        $statement->closeCursor();
        if ($row['requires_hearing'] !== $requiresHearing) {
            throw new RuntimeException('Typed hearing flag did not round-trip correctly.');
        }
        echo 'PASS: explicitly typed hearing flag ', $requiresHearing ? 'true' : 'false', ".\n";
    }
    $db->rollBack();
    echo "4/4 native PostgreSQL checks passed; no policy execution or data writes.\n";
} catch (Throwable $exception) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    // Connection errors can contain server details: do not print their message.
    fwrite(STDERR, 'FAIL: native PostgreSQL check (' . get_class($exception) . ', code ' . $exception->getCode() . ').' . PHP_EOL);
    exit(1);
}
