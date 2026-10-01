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

            // Fetch active announcements (where expiration_date is null or >= current_date).
            // Dashboard callers may request a small recent subset; the full
            // announcements page preserves its existing unlimited response.
            $limit = null;
            if (isset($_GET['limit']) && ctype_digit((string) $_GET['limit'])) {
                $limit = max(1, min(50, (int) $_GET['limit']));
            }

            $query = "
                SELECT 
                    a.announcement_id,
                    a.title,
                    a.content,
                    a.publish_date,
                    a.expiration_date,
                    a.created_at,
                    rp.first_name,
                    rp.last_name
                FROM announcements a
                LEFT JOIN users u ON a.created_by = u.user_id
                LEFT JOIN resident_profiles rp ON u.user_id = rp.user_id
                WHERE a.expiration_date IS NULL OR a.expiration_date >= CURRENT_DATE
                ORDER BY a.publish_date DESC, a.created_at DESC
            ";

            if ($limit !== null) {
                $query .= " LIMIT :limit";
            }
            
            $stmt = $db->prepare($query);
            if ($limit !== null) {
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            }
            $stmt->execute();
            
            $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($announcements);

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
