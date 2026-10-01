<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

if (!function_exists('apache_request_headers')) {
    function apache_request_headers() {
        $headers = array();
        foreach ($_SERVER as $key => $value) {
            if (substr($key, 0, 5) === 'HTTP_') {
                $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
                $headers[$header] = $value;
            }
        }
        return $headers;
    }
}

try {
    $headers = apache_request_headers();
    list($jwt) = sscanf($headers['Authorization'] ?? '', 'Bearer %s');
    if (!$jwt) {
        throw new Exception('Access denied.');
    }

    $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($jwt, new Key($jwt_secret, 'HS256'));
    if (!in_array($decoded->data->role, ['Homeowner', 'Renter'], true)) {
        http_response_code(403);
        echo json_encode(array('message' => 'Unauthorized access.'));
        exit();
    }

    $data = json_decode(file_get_contents('php://input'));
    $rating = isset($data->rating) ? (int) $data->rating : 0;
    $complaintId = trim($data->complaint_id ?? '');
    $comment = isset($data->comment) ? trim($data->comment) : null;
    if ($complaintId === '' || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(array('message' => 'A resolved complaint and a rating from 1 to 5 are required.'));
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $stmt = $db->prepare("\n+        SELECT c.complaint_id, c.resident_id\n+        FROM complaints c\n+        JOIN resident_profiles rp ON c.resident_id = rp.resident_id\n+        WHERE c.complaint_id = ?\n+          AND rp.user_id = ?\n+          AND c.complaint_status IN ('Resolved', 'Closed')\n+    ");
    $stmt->execute([$complaintId, $decoded->data->user_id]);
    $complaint = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$complaint) {
        http_response_code(404);
        echo json_encode(array('message' => 'This complaint cannot be rated.'));
        exit();
    }

    $stmt = $db->prepare("SELECT feedback_id FROM feedback WHERE complaint_id = ? AND resident_id = ? ORDER BY submitted_at DESC LIMIT 1");
    $stmt->execute([$complaintId, $complaint['resident_id']]);
    $feedbackId = $stmt->fetchColumn();
    if ($feedbackId) {
        $stmt = $db->prepare("UPDATE feedback SET rating = ?, comment = ?, submitted_at = CURRENT_TIMESTAMP WHERE feedback_id = ?");
        $stmt->execute([$rating, $comment ?: null, $feedbackId]);
    } else {
        $stmt = $db->prepare("INSERT INTO feedback (complaint_id, resident_id, rating, comment) VALUES (?, ?, ?, ?)");
        $stmt->execute([$complaintId, $complaint['resident_id'], $rating, $comment ?: null]);
    }

    echo json_encode(array('message' => 'Thank you for your feedback.'));
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(array('message' => 'Unable to submit feedback.', 'error' => $e->getMessage()));
}
?>
