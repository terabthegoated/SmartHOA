<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../');
$dotenv->safeLoad();

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

            $database = new Database();
            $db = $database->getConnection();

            // Inactive types are preserved for existing payment history, but
            // must not be available when an officer creates a new bill.
            $query = "
                SELECT payment_type_id, payment_name, description
                FROM payment_types
                WHERE is_active = TRUE
                ORDER BY display_order ASC, payment_name ASC
            ";
            $stmt = $db->prepare($query);
            $stmt->execute();
            
            $types = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($types);

        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode(array("message" => "Access denied.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
