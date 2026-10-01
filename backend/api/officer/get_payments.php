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
                    p.payment_id,
                    p.amount_due,
                    p.due_date,
                    p.billing_month,
                    p.payment_status,
                    pt.payment_name as type_name,
                    rp.first_name,
                    rp.last_name,
                    prop.block,
                    prop.lot,
                    pr.file_url as receipt_url
                FROM payments p
                LEFT JOIN payment_types pt ON p.payment_type_id = pt.payment_type_id
                LEFT JOIN resident_profiles rp ON p.resident_id = rp.resident_id
                LEFT JOIN properties prop ON rp.property_id = prop.property_id
                LEFT JOIN (
                    SELECT DISTINCT ON (payment_id) payment_id, file_url 
                    FROM payment_receipts 
                    ORDER BY payment_id, uploaded_at DESC
                ) pr ON p.payment_id = pr.payment_id
                ORDER BY p.created_at DESC
            ";
            
            $stmt = $db->prepare($query);
            $stmt->execute();
            
            $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($payments);

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
