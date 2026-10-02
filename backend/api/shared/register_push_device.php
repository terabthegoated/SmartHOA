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

try {
    $headers = apache_request_headers();
    list($jwt) = sscanf($headers['Authorization'] ?? '', 'Bearer %s');
    if (!$jwt) {
        throw new Exception('Access denied.');
    }

    $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
    $data = json_decode(file_get_contents('php://input'));
    $fcmToken = trim($data->fcm_token ?? '');
    $platform = trim($data->platform ?? 'android');

    if ($fcmToken === '' || !in_array($platform, ['android', 'ios'], true)) {
        http_response_code(400);
        echo json_encode(array('message' => 'A valid device token and platform are required.'));
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $stmt = $db->prepare("\n        INSERT INTO push_devices (user_id, fcm_token, platform, is_enabled)\n        VALUES (?, ?, ?, TRUE)\n        ON CONFLICT (fcm_token) DO UPDATE\n        SET user_id = EXCLUDED.user_id,\n            platform = EXCLUDED.platform,\n            is_enabled = TRUE,\n            updated_at = CURRENT_TIMESTAMP\n    ");
    $stmt->execute([$decoded->data->user_id, $fcmToken, $platform]);

    echo json_encode(array('message' => 'Push device registered.'));
} catch (Exception $e) {
    error_log('SmartHOA push-device registration failed: ' . $e->getMessage());
    http_response_code(401);
    echo json_encode(array('message' => 'Unable to register push device.', 'error' => $e->getMessage()));
}
?>
