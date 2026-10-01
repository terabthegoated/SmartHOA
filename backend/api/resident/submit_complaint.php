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
require_once __DIR__ . '/../../helpers/complaint_priority_rules.php';
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
                echo json_encode(array("message" => "Unauthorized access. Only residents can submit complaints."));
                exit();
            }

            if (!isset($_POST['category_id']) || !isset($_POST['title']) || !isset($_POST['description'])) {
                http_response_code(400);
                echo json_encode(array("message" => "Missing required fields."));
                exit();
            }

            $categoryId = trim((string) $_POST['category_id']);
            $title = trim((string) $_POST['title']);
            $description = trim((string) $_POST['description']);

            if ($categoryId === '' || $title === '' || $description === '') {
                http_response_code(400);
                echo json_encode(array("message" => "Category, title, and description are required."));
                exit();
            }

            if (strlen($title) > 255) {
                http_response_code(400);
                echo json_encode(array("message" => "Complaint title must be 255 characters or fewer."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();
            $db->beginTransaction();

            try {
                // Get resident_id
                $stmt = $db->prepare("SELECT resident_id FROM resident_profiles WHERE user_id = ?");
                $stmt->execute([$decoded->data->user_id]);
                $resident_id = $stmt->fetchColumn();

                if (!$resident_id) {
                    throw new Exception("Resident profile not found.");
                }

                // Use the resident's selected predefined category. The priority is
                // determined locally by transparent rules, not an external AI service.
                $categoryStmt = $db->prepare("SELECT category_id, category_name FROM complaint_categories WHERE category_id = ?");
                $categoryStmt->execute([$categoryId]);
                $category = $categoryStmt->fetch(PDO::FETCH_ASSOC);

                if (!$category) {
                    throw new InvalidArgumentException("The selected complaint category is not valid.");
                }

                $priorityRecommendation = smart_hoa_recommend_complaint_priority(
                    $category['category_name'],
                    $title,
                    $description
                );

                // Insert Complaint
                $query = "INSERT INTO complaints (
                    resident_id,
                    category_id,
                    title,
                    description,
                    complaint_status,
                    priority_level,
                    priority_recommendation,
                    priority_rule_code,
                    priority_reason
                ) VALUES (?, ?, ?, ?, 'Submitted', ?, ?, ?, ?) RETURNING complaint_id";
                $stmt = $db->prepare($query);
                $stmt->execute([
                    $resident_id, 
                    $category['category_id'],
                    $title,
                    $description,
                    $priorityRecommendation['priority_level'],
                    $priorityRecommendation['priority_level'],
                    $priorityRecommendation['rule_code'],
                    $priorityRecommendation['reason']
                ]);
                $complaint_id = $stmt->fetchColumn();

                // Handle file attachment if present
                if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
                    $upload_dir = '../../uploads/complaints/';
                    if (!file_exists($upload_dir)) {
                        mkdir($upload_dir, 0777, true);
                    }

                    $file = $_FILES['attachment'];
                    $file_extension = pathinfo($file['name'], PATHINFO_EXTENSION);
                    $new_filename = uniqid('complaint_', true) . '.' . $file_extension;
                    $target_file = $upload_dir . $new_filename;

                    if (move_uploaded_file($file['tmp_name'], $target_file)) {
                        $file_url = '/uploads/complaints/' . $new_filename;
                        $attach_query = "INSERT INTO complaint_attachments (complaint_id, file_url) VALUES (?, ?)";
                        $attach_stmt = $db->prepare($attach_query);
                        $attach_stmt->execute([$complaint_id, $file_url]);
                    }
                }

                $db->commit();
                http_response_code(201);
                echo json_encode(array(
                    "message" => "Complaint submitted successfully.",
                    "complaint_id" => $complaint_id,
                    "priority_level" => $priorityRecommendation['priority_level'],
                    "priority_recommendation" => $priorityRecommendation['priority_level'],
                    "priority_rule_code" => $priorityRecommendation['rule_code'],
                    "priority_reason" => $priorityRecommendation['reason']
                ));

            } catch (InvalidArgumentException $e) {
                $db->rollBack();
                http_response_code(400);
                echo json_encode(array("message" => $e->getMessage()));
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(array("message" => "Failed to submit complaint.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied."));
}
?>
