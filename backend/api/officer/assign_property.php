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
            
            if ($decoded->data->role !== 'Super Administrator' && $decoded->data->role !== 'HOA Officer') {
                http_response_code(403);
                echo json_encode(array("message" => "Unauthorized access."));
                exit();
            }

            $data = json_decode(file_get_contents("php://input"));
            
            if (empty($data->resident_id) || empty($data->block) || empty($data->lot)) {
                http_response_code(400);
                echo json_encode(array("message" => "Resident ID, Block, and Lot are required."));
                exit();
            }
            $property_use = $data->property_use ?? 'Homeowner';
            if (!in_array($property_use, ['Homeowner', 'Renter', 'Airbnb'], true)) {
                http_response_code(400);
                echo json_encode(array("message" => "Invalid property registration type."));
                exit();
            }

            $database = new Database();
            $db = $database->getConnection();
            $db->beginTransaction();

            try {
                $stmt = $db->prepare("SELECT resident_type FROM resident_profiles WHERE resident_id = ?");
                $stmt->execute([$data->resident_id]);
                $resident_type = $stmt->fetchColumn();
                if (!$resident_type) {
                    throw new Exception("Resident was not found.");
                }
                if ($property_use === 'Airbnb' && $resident_type !== 'Homeowner') {
                    throw new Exception("Only a homeowner can be assigned an Airbnb-hosted property.");
                }
                if ($resident_type === 'Renter' && $property_use !== 'Renter') {
                    throw new Exception("A renter must be assigned to a renter-occupied property.");
                }

                // Remove property_id from current resident (if any) and set old property to Vacant
                $stmt = $db->prepare("SELECT property_id FROM resident_profiles WHERE resident_id = ?");
                $stmt->execute([$data->resident_id]);
                $old_property_id = $stmt->fetchColumn();

                if ($old_property_id) {
                    $stmt = $db->prepare("UPDATE properties SET property_status = 'Vacant' WHERE property_id = ?");
                    $stmt->execute([$old_property_id]);
                }

                // Check if the requested Block & Lot exists
                $stmt = $db->prepare("SELECT property_id FROM properties WHERE block = ? AND lot = ?");
                $stmt->execute([$data->block, $data->lot]);
                $target_property_id = $stmt->fetchColumn();

                // If not exists, insert it
                if (!$target_property_id) {
                    $stmt = $db->prepare("INSERT INTO properties (block, lot, property_status, property_use) VALUES (?, ?, 'Occupied', ?) RETURNING property_id");
                    $stmt->execute([$data->block, $data->lot, $property_use]);
                    $target_property_id = $stmt->fetchColumn();
                } else {
                    // If exists, set to Occupied
                    $stmt = $db->prepare("UPDATE properties SET property_status = 'Occupied', property_use = ? WHERE property_id = ?");
                    $stmt->execute([$property_use, $target_property_id]);
                }

                // Update Resident Profile
                $stmt = $db->prepare("UPDATE resident_profiles SET property_id = ? WHERE resident_id = ?");
                $stmt->execute([$target_property_id, $data->resident_id]);

                if ($property_use === 'Airbnb') {
                    $stmt = $db->prepare("\n                        INSERT INTO airbnb_host_properties (property_id, host_resident_id, listing_status)\n                        VALUES (?, ?, 'Active')\n                        ON CONFLICT (property_id) DO UPDATE\n                        SET host_resident_id = EXCLUDED.host_resident_id,\n                            listing_status = 'Active',\n                            updated_at = CURRENT_TIMESTAMP\n                    ");
                    $stmt->execute([$target_property_id, $data->resident_id]);
                } else {
                    $stmt = $db->prepare("UPDATE airbnb_host_properties SET listing_status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE property_id = ?");
                    $stmt->execute([$target_property_id]);
                }

                $db->commit();
                
                http_response_code(200);
                echo json_encode(array("message" => "Property assigned successfully."));

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
    echo json_encode(array("message" => "Access denied."));
}
?>
