<?php
/**
 * SmartHOA daily payment-reminder scheduler entry point.
 *
 * Usage:
 *   php backend/scripts/run_payment_reminders.php
 *   php backend/scripts/run_payment_reminders.php --date=2026-10-17
 *
 * The optional date is intended for a controlled test or recovery run. Normal
 * scheduled tasks should omit it and use the Asia/Manila date automatically.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script can only run from the command line.\n");
    exit(1);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/payment_reminders.php';

$requestedDate = null;
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--help' || $argument === '-h') {
        echo "Usage: php backend/scripts/run_payment_reminders.php [--date=YYYY-MM-DD]\n";
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
    $summary = run_payment_reminders($db, $requestedDate);

    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(0);
} catch (Exception $exception) {
    error_log('SmartHOA scheduled payment reminders failed: ' . $exception->getMessage());
    fwrite(STDERR, "Payment reminder run failed. Check the server error log.\n");
    exit(1);
}
?>
