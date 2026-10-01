<?php
/**
 * SmartHOA daily collection-policy scheduler.
 *
 * Normal daily task:
 *   php backend/scripts/run_dues_collection_policy.php
 *
 * Controlled capstone test only:
 *   php backend/scripts/run_dues_collection_policy.php --date=2026-10-17
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script can only run from the command line.\n");
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/dues_collection_policy.php';

$requestedDate = null;
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--help' || $argument === '-h') {
        echo "Usage: php backend/scripts/run_dues_collection_policy.php [--date=YYYY-MM-DD]\n";
        exit(0);
    }

    if (strpos($argument, '--date=') === 0) {
        $requestedDate = substr($argument, 7);
        continue;
    }

    fwrite(STDERR, "Unknown option: " . $argument . "\n");
    exit(1);
}

if ($requestedDate !== null) {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $requestedDate, new DateTimeZone('Asia/Manila'));
    $errors = DateTimeImmutable::getLastErrors();
    if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        fwrite(STDERR, "--date must use the YYYY-MM-DD format.\n");
        exit(1);
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $summary = run_dues_collection_policy($db, $requestedDate);
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
} catch (Throwable $exception) {
    error_log('SmartHOA scheduled collection policy failed: ' . $exception->getMessage());
    fwrite(STDERR, "Collection policy did not complete. Check the server error log and database migration.\n");
    exit(1);
}
?>
