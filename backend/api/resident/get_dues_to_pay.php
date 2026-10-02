<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/dues_collection_policy.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

function dues_to_pay_headers() {
    if (function_exists('apache_request_headers')) {
        return apache_request_headers();
    }

    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) === 'HTTP_') {
            $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
            $headers[$header] = $value;
        }
    }
    return $headers;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed.']);
        exit();
    }

    $headers = dues_to_pay_headers();
    $authHeader = $headers['Authorization'] ?? '';
    if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['message' => 'Access denied.']);
        exit();
    }

    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($matches[1], new Key($jwtSecret, 'HS256'));
    if (!in_array($decoded->data->role, ['Homeowner', 'Renter'], true)) {
        http_response_code(403);
        echo json_encode(['message' => 'Unauthorized access.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();

    $residentStatement = $db->prepare("SELECT resident_id, move_in_date FROM resident_profiles WHERE user_id = ? LIMIT 1");
    $residentStatement->execute([$decoded->data->user_id]);
    $resident = $residentStatement->fetch(PDO::FETCH_ASSOC);

    if (!$resident) {
        echo json_encode([
            'status' => 'Not applicable',
            'amount_due' => 0,
            'base_dues' => 0,
            'penalty_amount' => 0,
            'billing_label' => '',
            'due_date' => null,
            'months_overdue' => 0,
            'collection_stage' => '',
            'message' => 'Your property has not been assigned yet.',
        ]);
        exit();
    }

    $timezone = new DateTimeZone('Asia/Manila');
    $today = new DateTimeImmutable('today', $timezone);
    $billingMonth = $today->format('Y-m-01');
    $dueDate = new DateTimeImmutable($today->format('Y-m') . '-16', $timezone);

    if (!empty($resident['move_in_date'])) {
        $moveInDate = new DateTimeImmutable($resident['move_in_date'], $timezone);
        if ($moveInDate > $today) {
            echo json_encode([
                'status' => 'Not applicable',
                'amount_due' => 0,
                'base_dues' => 0,
                'penalty_amount' => 0,
                'billing_label' => $today->format('F Y'),
                'due_date' => $dueDate->format('Y-m-d'),
                'months_overdue' => 0,
                'collection_stage' => '',
                'message' => 'Your dues will appear after your move-in date.',
            ]);
            exit();
        }
    }

    // The balance follows Board Resolution No. 12 (Series of 2025): every
    // unpaid monthly-dues entry (including an officer-issued dues + penalty
    // bill) is added to the running balance and a 10% compounding interest is
    // charged on that full balance after the 16th.
    // We intentionally use the bills recorded in SmartHOA instead of assuming
    // missing historical records are unpaid.
    $paymentStatement = $db->prepare("\n        SELECT\n            p.payment_id,\n            p.billing_month,\n            p.due_date,\n            p.amount_due,\n            p.payment_status\n        FROM payments p\n        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id\n        WHERE p.resident_id = ?\n          AND p.billing_month <= ?\n          AND LOWER(pt.payment_name) IN ('monthly hoa dues', 'monthly hoa dues + penalty')\n        ORDER BY p.due_date ASC, p.billing_month ASC, p.created_at ASC\n    ");
    $paymentStatement->execute([$resident['resident_id'], $billingMonth]);
    $paymentRecords = $paymentStatement->fetchAll(PDO::FETCH_ASSOC);

    // Keep individual bills separate. A resident can have a paid bill and a
    // newly generated unpaid bill in the same billing month; grouping by month
    // would incorrectly hide the new bill as paid.
    $periods = [];
    $currentMonthHasRecord = false;
    $currentMonthHasUnpaidRecord = false;
    foreach ($paymentRecords as $paymentRecord) {
        $monthKey = (new DateTimeImmutable($paymentRecord['billing_month'], $timezone))->format('Y-m-01');
        if ($monthKey === $billingMonth) {
            $currentMonthHasRecord = true;
        }

        if (in_array($paymentRecord['payment_status'], ['Paid', 'Cancelled'], true)) {
            continue;
        }

        $amount = round((float) $paymentRecord['amount_due'], 2);
        if ($amount <= 0) {
            continue;
        }

        if ($monthKey === $billingMonth) {
            $currentMonthHasUnpaidRecord = true;
        }

        $recordDueDate = !empty($paymentRecord['due_date'])
            ? new DateTimeImmutable($paymentRecord['due_date'], $timezone)
            : new DateTimeImmutable((new DateTimeImmutable($monthKey, $timezone))->format('Y-m') . '-16', $timezone);
        $periodKey = $recordDueDate->format('Y-m-d');

        if (!isset($periods[$periodKey])) {
            $periods[$periodKey] = [
                'due_date' => $recordDueDate,
                'base_amount' => 0.0,
            ];
        }
        $periods[$periodKey]['base_amount'] = round($periods[$periodKey]['base_amount'] + $amount, 2);
    }

    // A dashboard balance must always correspond to a bill the resident can
    // open and pay in My Bills. Do not invent a current-month ₱325 amount
    // before an officer or the collection policy has actually issued it.
    if (!$currentMonthHasRecord && empty($periods)) {
        echo json_encode([
            'status' => 'Awaiting bill',
            'amount_due' => 0,
            'base_dues' => 0,
            'penalty_amount' => 0,
            'billing_label' => $today->format('F Y'),
            'due_date' => $dueDate->format('Y-m-d'),
            'months_overdue' => 0,
            'collection_stage' => '',
            'message' => 'No monthly HOA dues bill has been issued to your account yet.',
        ]);
        exit();
    }
    ksort($periods);

    $currentMonthIsPaid = $currentMonthHasRecord && !$currentMonthHasUnpaidRecord;
    $displayDueDate = $dueDate;

    if (!empty($periods)) {
        $latestPeriod = end($periods);
        $displayDueDate = $latestPeriod['due_date'];
        reset($periods);
    }
    $calculation = dues_policy_calculate_periods($periods, $today);
    $runningBalance = $calculation['total_balance'];
    $baseDues = $calculation['base_balance'];
    $overdueMonths = $calculation['months_overdue'];

    if ($runningBalance === 0.0) {
        echo json_encode([
            'status' => 'Paid',
            'amount_due' => 0,
            'base_dues' => 0,
            'penalty_amount' => 0,
            'billing_label' => $today->format('F Y'),
            'due_date' => $displayDueDate->format('Y-m-d'),
            'months_overdue' => 0,
            'collection_stage' => '',
            'message' => 'Your ' . $today->format('F Y') . ' HOA dues are recorded as paid.',
        ]);
        exit();
    }

    $amountDue = round($runningBalance, 2);
    $penalty = round($amountDue - $baseDues, 2);
    $status = $overdueMonths > 0 ? 'Overdue' : 'Due';

    if ($overdueMonths >= 3) {
        $collectionStage = 'Third Notice – Hearing required';
        $message = $overdueMonths . ' unpaid months are on record. A due-process hearing must be scheduled before the Board may impose any account restriction.';
    } elseif ($overdueMonths === 2) {
        $collectionStage = 'Second Notice – Demand letter';
        $message = 'Your balance includes two unpaid months and 10% compounding interest. A demand letter should be issued.';
    } elseif ($overdueMonths === 1) {
        $collectionStage = 'First Notice';
        $message = 'The due date was ' . $displayDueDate->format('M j') . '. This balance includes 10% compounding interest and requires a formal first notice.';
    } else {
        $collectionStage = 'Current month – payment window open';
        $message = $currentMonthIsPaid
            ? 'Your current month is paid. Any balance shown is from an earlier unpaid HOA-dues bill.'
            : 'Pay on or before ' . $displayDueDate->format('M j') . ' to avoid 10% compounding interest on your outstanding balance.';
    }

    echo json_encode([
        'status' => $status,
        'amount_due' => $amountDue,
        'base_dues' => $baseDues,
        'penalty_amount' => $penalty,
        'billing_label' => $today->format('F Y'),
        'due_date' => $displayDueDate->format('Y-m-d'),
        'months_overdue' => $overdueMonths,
        'collection_stage' => $collectionStage,
        'message' => $message,
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'SmartHOA could not calculate the current dues.']);
}
?>
