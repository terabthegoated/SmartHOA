<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/fcm.php';
require_once __DIR__ . '/../../helpers/payment_settlement.php';
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $headers = array();
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) == 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}

$headers = apache_request_headers();
$authHeader = $headers['Authorization'] ?? '';

if ($authHeader) {
    list($jwt) = sscanf($authHeader, 'Bearer %s');
    if ($jwt) {
        try {
            $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
            $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
            
            if ($decoded->data->role !== 'Super Administrator' && $decoded->data->role !== 'HOA Officer') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            $data = json_decode(file_get_contents("php://input"));

            if (empty($data->payment_id)) {
                http_response_code(400);
                echo json_encode(array("message" => "Missing payment ID."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();
            $result = approve_recorded_payment($db, $data->payment_id, $decoded->data->user_id, $data->confirmed_amount ?? null);
            if (empty($result['already_approved'])) {
                send_fcm_push($db, [$result['recipient_id']], $result['title'], $result['notification_message'], 'Payment', '/my-payments');
            }
            echo json_encode(['message' => $result['message'], 'already_approved' => $result['already_approved']]);
        } catch (Exception $e) {
            $code = in_array($e->getCode(), [404, 409], true) ? $e->getCode() : 500;
            http_response_code($code);
            echo json_encode(['message' => $code === 500 ? 'Failed to approve payment.' : $e->getMessage()]);
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
