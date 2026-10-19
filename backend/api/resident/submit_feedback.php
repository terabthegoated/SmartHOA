<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/complaint_feedback.php';
Dotenv\Dotenv::createImmutable(__DIR__ . '/../../')->safeLoad();

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

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

$authenticated = false;
try {
    $headers = apache_request_headers();
    list($jwt) = sscanf($headers['Authorization'] ?? '', 'Bearer %s');
    if (!$jwt) {
        throw new Exception('Access denied.');
    }

    $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
    $authenticated = true;
    if (!in_array($decoded->data->role, ['Homeowner', 'Renter'], true)) {
        http_response_code(403);
        echo json_encode(array('message' => 'Unauthorized access.'));
        exit();
    }

    $data = json_decode(file_get_contents('php://input'));
    $rating = isset($data->rating) ? (int) $data->rating : 0;
    $complaintId = trim($data->complaint_id ?? '');
    $comment = isset($data->comment) ? trim($data->comment) : null;
    if ($complaintId === '' || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(array('message' => 'A resolved complaint and a rating from 1 to 5 are required.'));
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    save_complaint_feedback($db, $decoded->data->user_id, $complaintId, $data->rating ?? 0, $comment);
    echo json_encode(array('message' => 'Thank you for your feedback.'));
} catch (Exception $e) {
    $code = !$authenticated ? 401 : (in_array($e->getCode(), [400, 404], true) ? $e->getCode() : 500);
    http_response_code($code);
    if ($code === 500) error_log('SmartHOA feedback save failed: ' . $e->getMessage());
    echo json_encode(['message' => $code === 401 ? 'Access denied.' : ($code === 500 ? 'Unable to submit feedback. Please try again.' : $e->getMessage())]);
}
?>
