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

            $stats = array(
                "total_residents" => 0,
                "total_properties" => 0,
                "outstanding_dues" => 0,
                "pending_verifications" => 0
            );

            // 1. Total Residents
            $stmt = $db->query("SELECT COUNT(*) FROM resident_profiles");
            $stats["total_residents"] = (int)$stmt->fetchColumn();

            // 2. Total Properties
            $stmt = $db->query("SELECT COUNT(*) FROM properties");
            $stats["total_properties"] = (int)$stmt->fetchColumn();

            // 3. Outstanding Dues (Total amount of Pending/Overdue payments)
            $stmt = $db->query("SELECT COALESCE(SUM(amount_due), 0) FROM payments WHERE payment_status IN ('Pending', 'Overdue')");
            $stats["outstanding_dues"] = (float)$stmt->fetchColumn();

            // 4. Pending Verifications (Payments marked 'Pending' but have an uploaded receipt)
            $stmt = $db->query("
                SELECT COUNT(DISTINCT p.payment_id) 
                FROM payments p
                INNER JOIN payment_receipts pr ON p.payment_id = pr.payment_id
                WHERE p.payment_status = 'Pending'
            ");
            $stats["pending_verifications"] = (int)$stmt->fetchColumn();

            echo json_encode($stats);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(array("message" => "Failed to fetch stats.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
