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

            if (empty($data->title) || empty($data->content)) {
                http_response_code(400);
                echo json_encode(array("message" => "Title and content are required."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();

            $publish_date = !empty($data->publish_date) ? $data->publish_date : date('Y-m-d');
            $expiration_date = !empty($data->expiration_date) ? $data->expiration_date : null;

            $query = "INSERT INTO announcements (created_by, title, content, publish_date, expiration_date) VALUES (?, ?, ?, ?, ?)";
            $stmt = $db->prepare($query);
            
            if ($stmt->execute([$decoded->data->user_id, $data->title, $data->content, $publish_date, $expiration_date])) {
                
                // Blast notification to all residents
                $notif_title = "New Announcement";
                $notif_message = "Admin posted a new announcement: " . substr($data->title, 0, 50) . (strlen($data->title) > 50 ? '...' : '');
                
                $notif_query = "
                    INSERT INTO notifications (recipient_id, title, message, notification_type)
                    SELECT user_id, ?, ?, 'General'
                    FROM users 
                    WHERE role_id IN (
                        SELECT role_id FROM roles WHERE role_name IN ('Homeowner', 'Renter')
                    )
                ";
                $notif_stmt = $db->prepare($notif_query);
                $notif_stmt->execute([$notif_title, $notif_message]);

                $recipient_stmt = $db->prepare("SELECT u.user_id FROM users u JOIN roles r ON u.role_id = r.role_id WHERE r.role_name IN ('Homeowner', 'Renter')");
                $recipient_stmt->execute();
                $recipient_ids = $recipient_stmt->fetchAll(PDO::FETCH_COLUMN);
                send_fcm_push($db, $recipient_ids, $notif_title, $notif_message, 'General', '/announcements');

                http_response_code(201);
                echo json_encode(array("message" => "Announcement published."));
            } else {
                http_response_code(503);
                echo json_encode(array("message" => "Unable to publish announcement."));
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
