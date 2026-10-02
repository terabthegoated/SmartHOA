<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

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
        $headers = [];
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

if (!$authHeader) {
    http_response_code(401);
    echo json_encode(['message' => 'Access denied.']);
    exit();
}

[$jwt] = sscanf($authHeader, 'Bearer %s');
if (!$jwt) {
    http_response_code(401);
    echo json_encode(['message' => 'Access denied.']);
    exit();
}

try {
    // Constructing Database loads local .env values, while Render supplies
    // environment values directly. The endpoint fails closed without a secret.
    $database = new Database();
    $jwtSecret = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? '');
    if ($jwtSecret === '') {
        throw new RuntimeException('JWT_SECRET is not configured.');
    }

    $decoded = JWT::decode($jwt, new Key($jwtSecret, 'HS256'));

    if (!in_array($decoded->data->role, ['Homeowner', 'Renter'], true)) {
        http_response_code(403);
        echo json_encode(['message' => 'Unauthorized access.']);
        exit();
    }

    $db = $database->getConnection();
    $statement = $db->prepare("\n        SELECT COUNT(*)\n        FROM complaints c\n        JOIN resident_profiles rp ON rp.resident_id = c.resident_id\n        WHERE rp.user_id = ?\n          AND c.complaint_status NOT IN ('Resolved', 'Closed')\n    ");
    $statement->execute([$decoded->data->user_id]);

    echo json_encode([
        'active_count' => (int) $statement->fetchColumn(),
    ]);
} catch (Throwable $exception) {
    error_log('SmartHOA complaint summary error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Unable to load the complaint summary right now.']);
}
