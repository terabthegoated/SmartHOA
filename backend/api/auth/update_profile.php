<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

// Support custom server environments (like PHP's built-in server)
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
            
            $data = json_decode(file_get_contents("php://input"));
            
            $database = new Database();
            $db = $database->getConnection();
            $db->beginTransaction();

            try {
                // 1. Resolve Property
                $property_id = null;
                if (!empty($data->block) && !empty($data->lot)) {
                    // Check if exists
                    $stmt = $db->prepare("SELECT property_id FROM properties WHERE block = ? AND lot = ?");
                    $stmt->execute([$data->block, $data->lot]);
                    $property_id = $stmt->fetchColumn();

                    if (!$property_id) {
                        $stmt = $db->prepare("INSERT INTO properties (block, lot, property_status) VALUES (?, ?, 'Occupied') RETURNING property_id");
                        $stmt->execute([$data->block, $data->lot]);
                        $property_id = $stmt->fetchColumn();
                    } else {
                        // Mark new property as Occupied
                        $stmt = $db->prepare("UPDATE properties SET property_status = 'Occupied' WHERE property_id = ?");
                        $stmt->execute([$property_id]);
                    }
                }

                // 2. Get Old Property
                $stmt = $db->prepare("SELECT property_id FROM resident_profiles WHERE user_id = ?");
                $stmt->execute([$decoded->data->user_id]);
                $old_property_id = $stmt->fetchColumn();

                // 3. Mark old property as Vacant if property is changing
                if ($old_property_id && $old_property_id !== $property_id) {
                    $stmt = $db->prepare("UPDATE properties SET property_status = 'Vacant' WHERE property_id = ?");
                    $stmt->execute([$old_property_id]);
                }

                // 4. Update Resident Profile
                $query = "
                    UPDATE resident_profiles
                    SET first_name = ?, last_name = ?, contact_number = ?, property_id = ?
                    WHERE user_id = ?
                ";
                $stmt = $db->prepare($query);
                $stmt->execute([
                    $data->firstName,
                    $data->lastName,
                    $data->contactNumber,
                    $property_id,
                    $decoded->data->user_id
                ]);

                $db->commit();
                http_response_code(200);
                echo json_encode(array("message" => "Profile updated successfully."));
            } catch (Exception $e) {
                $db->rollBack();
                throw $e;
            }
        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode(array("message" => "Access denied.", "error" => $e->getMessage()));
        }
    }
} else {
    http_response_code(401);
    echo json_encode(array("message" => "Access denied. No Authorization header found."));
}
?>
