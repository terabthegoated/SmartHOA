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
require_once __DIR__ . '/../../helpers/fcm.php';
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

            $data = json_decode(file_get_contents("php://input"));

            if (empty($data->payment_id)) {
                http_response_code(400);
                echo json_encode(array("message" => "Missing payment ID."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();
            $db->beginTransaction();

            try {
                // Get the payment amount and the user_id to notify
                $stmt = $db->prepare("
                    SELECT p.amount_due, rp.user_id, pt.payment_name as type_name
                    FROM payments p 
                    JOIN resident_profiles rp ON p.resident_id = rp.resident_id
                    LEFT JOIN payment_types pt ON p.payment_type_id = pt.payment_type_id
                    WHERE p.payment_id = ?
                ");
                $stmt->execute([$data->payment_id]);
                $payment_info = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$payment_info) {
                    throw new Exception("Payment not found.");
                }

                $amount_due = $payment_info['amount_due'];
                $recipient_user_id = $payment_info['user_id'];
                $type_name = $payment_info['type_name'] ?? 'HOA Dues';

                // Update payment status to Paid
                $stmt = $db->prepare("UPDATE payments SET payment_status = 'Paid' WHERE payment_id = ?");
                $stmt->execute([$data->payment_id]);

                // Insert into payment_transactions
                $stmt = $db->prepare("
                    INSERT INTO payment_transactions (payment_id, amount_paid, payment_date, approved_by, remarks) 
                    VALUES (?, ?, CURRENT_DATE, ?, 'Approved by Officer')
                ");
                $stmt->execute([$data->payment_id, $amount_due, $decoded->data->user_id]);

                // Insert Notification
                $notif_title = "Payment Approved";
                $notif_message = "Your payment of ₱" . number_format($amount_due, 2) . " for {$type_name} has been verified and approved.";
                $stmt = $db->prepare("
                    INSERT INTO notifications (recipient_id, title, message, notification_type) 
                    VALUES (?, ?, ?, 'Payment')
                ");
                $stmt->execute([$recipient_user_id, $notif_title, $notif_message]);

                $db->commit();
                send_fcm_push($db, [$recipient_user_id], $notif_title, $notif_message, 'Payment', '/my-payments');
                http_response_code(200);
                echo json_encode(array("message" => "Payment successfully approved."));
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(array("message" => "Failed to approve payment.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
