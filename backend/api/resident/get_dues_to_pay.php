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

    $paymentStatement = $db->prepare("
        SELECT p.payment_id, p.resident_id, p.billing_month, p.due_date,
               p.amount_due, p.payment_status, pt.payment_name AS type_name,
               (SELECT MIN(pr.uploaded_at) FROM payment_receipts pr
                WHERE pr.payment_id = p.payment_id) AS receipt_submitted_at
        FROM payments p
        INNER JOIN payment_types pt ON pt.payment_type_id = p.payment_type_id
        WHERE p.resident_id = ?
          AND LOWER(TRIM(pt.payment_name)) IN ('monthly hoa dues', 'monthly hoa dues + penalty')
        ORDER BY p.due_date, p.payment_id
    ");
    $paymentStatement->execute([$resident['resident_id']]);
    $views = dues_balance_payment_views($paymentStatement->fetchAll(PDO::FETCH_ASSOC), $today);
    echo json_encode(dues_balance_summary($views, $today));
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['message' => 'SmartHOA could not calculate the current dues.']);
}
?>
