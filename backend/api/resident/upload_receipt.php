<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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
            
            if ($decoded->data->role !== 'Homeowner' && $decoded->data->role !== 'Renter') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            if (!isset($_POST['payment_id']) || !isset($_FILES['receipt'])) {
                http_response_code(400);
                echo json_encode(array("message" => "Missing payment ID or receipt file."));
                exit();
            }

            $payment_id = $_POST['payment_id'];
            $file = $_FILES['receipt'];

            // Create uploads directory if it doesn't exist
            $upload_dir = '../../uploads/receipts/';
            if (!file_exists($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }

            // Generate unique filename
            $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $new_filename = uniqid('receipt_', true) . '.' . $file_extension;
            $target_file = $upload_dir . $new_filename;

            // Save file
            if (move_uploaded_file($file['tmp_name'], $target_file)) {
                $database = new Database();
                $db = $database->getConnection();

                $file_url = '/uploads/receipts/' . $new_filename;

                $query = "INSERT INTO payment_receipts (payment_id, file_url) VALUES (?, ?)";
                $stmt = $db->prepare($query);
                $stmt->execute([$payment_id, $file_url]);

                echo json_encode(array(
                    "message" => "Receipt uploaded successfully.",
                    "file_url" => $file_url
                ));
            } else {
                http_response_code(500);
                echo json_encode(array("message" => "Failed to save uploaded file."));
            }

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
