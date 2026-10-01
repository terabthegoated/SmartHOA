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

            if (!is_object($data) || empty($data->complaint_id)) {
                http_response_code(400);
                echo json_encode(array("message" => "Complaint ID is required."));
                exit();
            }

            $hasStatus = property_exists($data, 'status') && trim((string) $data->status) !== '';
            $hasPriority = property_exists($data, 'priority_level') && trim((string) $data->priority_level) !== '';

            if (!$hasStatus && !$hasPriority) {
                http_response_code(400);
                echo json_encode(array("message" => "Provide a status update or a priority override."));
                exit();
            }

            $valid_statuses = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
            if ($hasStatus && !in_array(trim((string) $data->status), $valid_statuses, true)) {
                http_response_code(400);
                echo json_encode(array("message" => "Invalid status."));
                exit();
            }

            $valid_priorities = ['Low', 'Medium', 'High', 'Critical'];
            if ($hasPriority && !in_array(trim((string) $data->priority_level), $valid_priorities, true)) {
                http_response_code(400);
                echo json_encode(array("message" => "Invalid priority level."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();
            $db->beginTransaction();

            try {
                $stmt = $db->prepare("
                    SELECT complaint_status, priority_level, priority_recommendation, priority_overridden_at
                    FROM complaints
                    WHERE complaint_id = ?
                    FOR UPDATE
                ");
                $stmt->execute([$data->complaint_id]);
                $complaint = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$complaint) {
                    throw new InvalidArgumentException("Complaint not found.");
                }

                $status = $hasStatus ? trim((string) $data->status) : $complaint['complaint_status'];
                $statusChanged = $status !== $complaint['complaint_status'];
                $priority = $hasPriority ? trim((string) $data->priority_level) : $complaint['priority_level'];
                $recommendation = $complaint['priority_recommendation'];
                $currentPriorityIsOverridden = $complaint['priority_overridden_at'] !== null;
                $isPriorityOverride = false;
                $overrideReason = null;

                if ($hasPriority) {
                    // A legacy complaint with no recommendation is also treated as
                    // an override, so an officer's reasoning is always recorded.
                    $isPriorityOverride = $recommendation === null || $priority !== $recommendation;
                    if ($isPriorityOverride) {
                        $overrideReason = trim((string) ($data->priority_override_reason ?? ''));
                        if (strlen($overrideReason) < 3) {
                            throw new InvalidArgumentException("Provide a brief reason when overriding the system priority recommendation.");
                        }
                    }
                }

                $setParts = array('complaint_status = ?', 'updated_at = CURRENT_TIMESTAMP');
                $params = array($status);

                // Preserve the existing assignment behavior for status changes,
                // while a priority-only review does not silently assign the case.
                if ($hasStatus) {
                    $setParts[] = 'assigned_officer = ?';
                    $params[] = $decoded->data->user_id;
                }

                if ($hasPriority) {
                    $setParts[] = 'priority_level = ?';
                    $params[] = $priority;
                    $setParts[] = 'priority_overridden_by = ?';
                    $params[] = $isPriorityOverride ? $decoded->data->user_id : null;
                    $setParts[] = $isPriorityOverride
                        ? 'priority_overridden_at = CURRENT_TIMESTAMP'
                        : 'priority_overridden_at = NULL';
                    $setParts[] = 'priority_override_reason = ?';
                    $params[] = $isPriorityOverride ? $overrideReason : null;
                }

                $params[] = $data->complaint_id;
                $query = 'UPDATE complaints SET ' . implode(', ', $setParts) . ' WHERE complaint_id = ?';
                $stmt = $db->prepare($query);
                if (!$stmt->execute($params)) {
                    throw new Exception("Unable to update complaint.");
                }

                $remarks = property_exists($data, 'remarks') ? trim((string) $data->remarks) : '';
                if ($hasPriority) {
                    $priorityAudit = $isPriorityOverride
                        ? "Priority overridden to {$priority}. Reason: {$overrideReason}"
                        : "Priority restored to the system recommendation ({$recommendation}).";
                    $remarks = $remarks !== '' ? $remarks . "\n\n" . $priorityAudit : $priorityAudit;
                }

                $stmt = $db->prepare("INSERT INTO complaint_updates (complaint_id, officer_id, status, remarks) VALUES (?, ?, ?, ?)");
                $stmt->execute([$data->complaint_id, $decoded->data->user_id, $status, $remarks !== '' ? $remarks : null]);

                $recipient_user_id = null;
                $notif_title = null;
                $notif_message = null;

                // Residents are notified of a status change; changing an internal
                // queue priority alone does not generate a misleading status alert.
                if ($statusChanged) {
                    $stmt = $db->prepare("
                        SELECT rp.user_id, cc.category_name
                        FROM complaints c
                        JOIN resident_profiles rp ON c.resident_id = rp.resident_id
                        LEFT JOIN complaint_categories cc ON c.category_id = cc.category_id
                        WHERE c.complaint_id = ?
                    ");
                    $stmt->execute([$data->complaint_id]);
                    $complaint_info = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($complaint_info) {
                        $recipient_user_id = $complaint_info['user_id'];
                        $category_name = $complaint_info['category_name'] ?? 'Issue';
                        $notif_title = "Complaint Status Updated";
                        $notif_message = "Your complaint regarding '{$category_name}' has been marked as {$status}.";

                        $stmt = $db->prepare("
                            INSERT INTO notifications (recipient_id, title, message, notification_type)
                            VALUES (?, ?, ?, 'Complaint')
                        ");
                        $stmt->execute([$recipient_user_id, $notif_title, $notif_message]);
                    }
                }

                $db->commit();
                if ($recipient_user_id !== null) {
                    send_fcm_push($db, [$recipient_user_id], $notif_title, $notif_message, 'Complaint', '/my-complaints');
                }
                $priorityIsOverridden = $hasPriority ? $isPriorityOverride : $currentPriorityIsOverridden;
                $prioritySource = $priorityIsOverridden
                    ? "Officer override"
                    : ($recommendation === null ? "Legacy priority" : "System recommendation");
                http_response_code(200);
                echo json_encode(array(
                    "message" => $hasPriority && !$hasStatus ? "Complaint priority updated." : "Complaint updated.",
                    "complaint_status" => $status,
                    "priority_level" => $priority,
                    "priority_recommendation" => $recommendation,
                    "priority_is_overridden" => $priorityIsOverridden,
                    "priority_source" => $prioritySource
                ));
            } catch (InvalidArgumentException $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                http_response_code(400);
                echo json_encode(array("message" => $e->getMessage()));
            } catch (Exception $e) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                http_response_code(503);
                echo json_encode(array("message" => $e->getMessage()));
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
