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
            
            if ($decoded->data->role !== 'Super Administrator' && $decoded->data->role !== 'HOA Officer') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();

            $query = "
                SELECT 
                    c.complaint_id,
                    c.title,
                    c.description,
                    c.complaint_status,
                    c.priority_level,
                    c.priority_recommendation,
                    c.priority_rule_code,
                    c.priority_reason,
                    c.priority_override_reason,
                    c.priority_overridden_at,
                    CASE WHEN c.priority_overridden_at IS NULL THEN FALSE ELSE TRUE END AS priority_is_overridden,
                    CASE
                        WHEN c.priority_overridden_at IS NOT NULL THEN 'Officer override'
                        WHEN c.priority_recommendation IS NULL THEN 'Legacy priority'
                        ELSE 'System recommendation'
                    END AS priority_source,
                    c.created_at,
                    cc.category_name,
                    rp.first_name,
                    rp.last_name,
                    prop.block,
                    prop.lot,
                    ca.file_url
                FROM complaints c
                LEFT JOIN complaint_categories cc ON c.category_id = cc.category_id
                LEFT JOIN resident_profiles rp ON c.resident_id = rp.resident_id
                LEFT JOIN properties prop ON rp.property_id = prop.property_id
                LEFT JOIN (
                    SELECT DISTINCT ON (complaint_id) complaint_id, file_url 
                    FROM complaint_attachments 
                    ORDER BY complaint_id, uploaded_at DESC
                ) ca ON c.complaint_id = ca.complaint_id
                ORDER BY c.created_at DESC
            ";
            
            $stmt = $db->prepare($query);
            $stmt->execute();
            
            $complaints = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($complaints);

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
