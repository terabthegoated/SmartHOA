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
require_once __DIR__ . '/../../helpers/payment_settlement.php';
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

            $paymentId = trim((string) $_POST['payment_id']);
            $file = $_FILES['receipt'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) > 5 * 1024 * 1024) {
                http_response_code(400);
                echo json_encode(['message' => 'Upload a receipt image no larger than 5 MB.']);
                exit();
            }
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
            $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (!isset($extensions[$mime])) {
                http_response_code(400);
                echo json_encode(['message' => 'Receipt must be a JPEG, PNG or WebP image.']);
                exit();
            }
            $database = new Database();
            $db = $database->getConnection();
            // Resolve ownership before accepting any file or freezing a balance.
            $lookup = $db->prepare('SELECT p.resident_id FROM payments p JOIN resident_profiles rp ON rp.resident_id = p.resident_id WHERE p.payment_id = ? AND rp.user_id = ?');
            $lookup->execute([$paymentId, $decoded->data->user_id]);
            $residentId = $lookup->fetchColumn();
            if (!$residentId) {
                http_response_code(404);
                echo json_encode(['message' => 'Bill not found for your account.']);
                exit();
            }
            $savedFile = null;
            $db->beginTransaction();
            try {
                dues_balance_lock_resident($db, $residentId);
                $bill = $db->prepare('SELECT payment_status, EXISTS(SELECT 1 FROM payment_receipts r WHERE r.payment_id = p.payment_id) AS has_receipt FROM payments p WHERE payment_id = ?');
                $bill->execute([$paymentId]);
                $row = $bill->fetch(PDO::FETCH_ASSOC);
                if (!in_array($row['payment_status'], ['Pending', 'Overdue'], true) || $row['has_receipt']) {
                    throw new RuntimeException('This bill is already settled or has a receipt under review.', 409);
                }
                $directory = __DIR__ . '/../../uploads/receipts/';
                if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                    throw new RuntimeException('Receipt storage is unavailable.');
                }
                $filename = 'receipt_' . bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
                $target = $directory . $filename;
                if (!move_uploaded_file($file['tmp_name'], $target)) throw new RuntimeException('Receipt could not be stored.');
                $savedFile = $target;
                $fileUrl = '/uploads/receipts/' . $filename;
                $db->prepare('INSERT INTO payment_receipts (payment_id, file_url) VALUES (?, ?)')->execute([$paymentId, $fileUrl]);
                $db->commit();
                echo json_encode(['message' => 'Receipt uploaded successfully.', 'file_url' => $fileUrl]);
            } catch (Throwable $error) {
                if ($db->inTransaction()) $db->rollBack();
                if ($savedFile !== null && is_file($savedFile)) unlink($savedFile);
                throw $error;
            }
        } catch (Exception $e) {
            $code = $e->getCode() === 409 ? 409 : 500;
            http_response_code($code);
            echo json_encode(['message' => $code === 409 ? $e->getMessage() : 'Unable to submit receipt. Please sign in again or retry.']);
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
