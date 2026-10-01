<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("message" => "Method not allowed."));
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/payment_reminders.php';

use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $headers = array();
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}

$headers = apache_request_headers();
$authHeader = $headers['Authorization'] ?? '';
list($jwt) = sscanf($authHeader, 'Bearer %s');

if (!$jwt) {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
    exit();
}

try {
    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($jwt, new Key($jwtSecret, 'HS256'));
    $role = $decoded->data->role ?? '';

    if ($role !== 'Super Administrator' && $role !== 'HOA Officer') {
        http_response_code(403);
        echo json_encode(array("message" => "Unauthorized access."));
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $summary = run_payment_reminders($db);

    echo json_encode(array(
        "message" => "Payment reminder run completed.",
        "run_date" => $summary['run_date'],
        "eligible" => $summary['eligible'],
        "sent" => $summary['sent'],
        "already_sent" => $summary['already_sent'],
        "skipped" => $summary['skipped'],
        "by_stage" => $summary['by_stage']
    ));
} catch (\Firebase\JWT\ExpiredException $exception) {
    http_response_code(401);
    echo json_encode(array("message" => "Your session has expired. Please log in again."));
} catch (\Firebase\JWT\SignatureInvalidException $exception) {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
} catch (Exception $exception) {
    error_log('SmartHOA payment reminder run failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(array("message" => "Unable to run payment reminders right now."));
}
?>
