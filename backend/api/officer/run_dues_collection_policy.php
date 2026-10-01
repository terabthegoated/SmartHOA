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
    echo json_encode(['message' => 'Method not allowed.']);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../../helpers/dues_collection_policy.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

function dues_policy_endpoint_headers() {
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
    $headers = dues_policy_endpoint_headers();
    $authHeader = $headers['Authorization'] ?? '';
    if (!$authHeader || !preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(['message' => 'Access denied.']);
        exit();
    }

    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($matches[1], new Key($jwtSecret, 'HS256'));
    $role = $decoded->data->role ?? '';
    if ($role !== 'Super Administrator' && $role !== 'HOA Officer') {
        http_response_code(403);
        echo json_encode(['message' => 'Only HOA officers can run the collection policy.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $summary = run_dues_collection_policy($db);

    echo json_encode([
        'message' => 'Collection policy completed.',
        'summary' => $summary
    ]);
} catch (\Firebase\JWT\ExpiredException $exception) {
    http_response_code(401);
    echo json_encode(['message' => 'Your session has expired. Please log in again.']);
} catch (\Firebase\JWT\SignatureInvalidException $exception) {
    http_response_code(401);
    echo json_encode(['message' => 'Access denied.']);
} catch (Throwable $exception) {
    error_log('SmartHOA collection policy failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        'message' => 'Unable to run the collection policy. Make sure the latest database migration has been applied.'
    ]);
}
?>
