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

            $database = new Database();
            $db = $database->getConnection();

            // Auto-seed if empty
            $countStmt = $db->query("SELECT COUNT(*) FROM complaint_categories");
            if ($countStmt->fetchColumn() == 0) {
                $defaultCats = [
                    ['Maintenance', 'Issues regarding roads, streetlights, or facilities.'],
                    ['Security', 'Reports of suspicious activities or security concerns.'],
                    ['Noise Disturbance', 'Complaints about excessive noise from neighbors.'],
                    ['Sanitation', 'Issues with garbage collection or cleanliness.'],
                    ['Dispute', 'Conflicts between residents requiring mediation.']
                ];
                $insertStmt = $db->prepare("INSERT INTO complaint_categories (category_name, description) VALUES (?, ?)");
                foreach ($defaultCats as $cat) {
                    $insertStmt->execute($cat);
                }
            }

            $stmt = $db->query("SELECT * FROM complaint_categories ORDER BY category_name ASC");
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($categories);

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
