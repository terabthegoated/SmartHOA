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
            
            // Allow Homeowners and Renters
            if ($decoded->data->role !== 'Homeowner' && $decoded->data->role !== 'Renter') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();

            // Start from the signed-in user's resident profile. This keeps the
            // same empty-array result for users without a profile while
            // avoiding an extra database round trip on every page load.
            $query = "
                SELECT 
                    p.payment_id,
                    p.amount_due,
                    p.due_date,
                    p.billing_month,
                    p.payment_status,
                    pt.payment_name as type_name,
                    EXISTS(SELECT 1 FROM payment_receipts pr WHERE pr.payment_id = p.payment_id) as has_receipt
                FROM payments p
                LEFT JOIN payment_types pt ON p.payment_type_id = pt.payment_type_id
                INNER JOIN resident_profiles rp ON rp.resident_id = p.resident_id
                WHERE rp.user_id = ?
                ORDER BY p.created_at DESC
            ";
            
            $stmt = $db->prepare($query);
            $stmt->execute([$decoded->data->user_id]);
            
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
