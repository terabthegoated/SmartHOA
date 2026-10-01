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

    $jwtSecret = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me');
    $decoded = JWT::decode($jwt, new Key($jwtSecret, 'HS256'));
    $data = json_decode(file_get_contents('php://input'));
    $keys = is_object($data->keys ?? null) ? $data->keys : new stdClass();
    $endpoint = trim((string) ($data->endpoint ?? ''));
    $p256dhKey = trim((string) ($keys->p256dh ?? ''));
    $authKey = trim((string) ($keys->auth ?? ''));
    $expirationTime = isset($data->expiration_time) && $data->expiration_time !== null
        ? (int) $data->expiration_time
        : null;

    if ($endpoint === '' || !filter_var($endpoint, FILTER_VALIDATE_URL) || $p256dhKey === '' || $authKey === '') {
        http_response_code(400);
        echo json_encode(array('message' => 'A valid browser notification subscription is required.'));
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $stmt = $db->prepare("\n        INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh_key, auth_key, expiration_time, is_enabled)\n        VALUES (?, ?, ?, ?, ?, TRUE)\n        ON CONFLICT (endpoint) DO UPDATE\n        SET user_id = EXCLUDED.user_id,\n            p256dh_key = EXCLUDED.p256dh_key,\n            auth_key = EXCLUDED.auth_key,\n            expiration_time = EXCLUDED.expiration_time,\n            is_enabled = TRUE,\n            updated_at = CURRENT_TIMESTAMP\n    ");
    $stmt->execute([$decoded->data->user_id, $endpoint, $p256dhKey, $authKey, $expirationTime]);

    echo json_encode(array('message' => 'Browser notifications enabled.'));
} catch (Exception $e) {
    error_log('SmartHOA web push subscription error: ' . $e->getMessage());
    http_response_code(401);
    echo json_encode(array('message' => 'Unable to enable browser notifications.'));
}
?>
