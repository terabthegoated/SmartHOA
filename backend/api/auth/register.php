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

$data = json_decode(file_get_contents("php://input"));

if (
    empty($data->first_name) || empty($data->last_name) || 
    empty($data->email) || empty($data->password) || 
    empty($data->resident_type) || empty($data->block) || empty($data->lot)
) {
    http_response_code(400);
    echo json_encode(array("message" => "Please fill out all required fields."));
    exit();
}

if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$/', $data->password)) {
    http_response_code(400);
    echo json_encode(array("message" => "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character such as _ or !."));
    exit();
}

$property_use = $data->property_use ?? 'Homeowner';
if (!in_array($property_use, ['Homeowner', 'Renter', 'Airbnb'], true)) {
    http_response_code(400);
    echo json_encode(array("message" => "Invalid property registration type."));
    exit();
}
if ($property_use === 'Airbnb' && $data->resident_type !== 'Homeowner') {
    http_response_code(400);
    echo json_encode(array("message" => "An Airbnb-hosted property must be registered by a homeowner."));
    exit();
}
if ($data->resident_type === 'Renter' && $property_use !== 'Renter') {
    http_response_code(400);
    echo json_encode(array("message" => "A renter account must be registered to a renter-occupied property."));
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $db->beginTransaction();

    // 1. Get the Role ID
    $stmt = $db->prepare("SELECT role_id FROM roles WHERE role_name = ?");
    $stmt->execute([$data->resident_type]);
    $role_id = $stmt->fetchColumn();

    if (!$role_id) {
        throw new Exception("Invalid resident type selected.");
    }

    // 2. Check if Email Exists
    $stmt = $db->prepare("SELECT user_id FROM users WHERE email = ?");
    $stmt->execute([$data->email]);
    if ($stmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(array("message" => "Email address is already in use."));
        exit();
    }

    // 3. Create User
    $password_hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (role_id, email, password_hash, is_verified, account_status) VALUES (?, ?, ?, FALSE, 'Active') RETURNING user_id");
    $stmt->execute([$role_id, $data->email, $password_hash]);
    $user_id = $stmt->fetchColumn();

    // 4. Resolve Property (Block & Lot)
    $stmt = $db->prepare("SELECT property_id FROM properties WHERE block = ? AND lot = ?");
    $stmt->execute([$data->block, $data->lot]);
    $property_id = $stmt->fetchColumn();

    if (!$property_id) {
        $stmt = $db->prepare("INSERT INTO properties (block, lot, property_status, property_use) VALUES (?, ?, 'Occupied', ?) RETURNING property_id");
        $stmt->execute([$data->block, $data->lot, $property_use]);
        $property_id = $stmt->fetchColumn();
    } else {
        $stmt = $db->prepare("UPDATE properties SET property_status = 'Occupied', property_use = CASE WHEN ? IN ('Renter', 'Airbnb') THEN ? ELSE property_use END WHERE property_id = ?");
        $stmt->execute([$property_use, $property_use, $property_id]);
    }

    // 5. Create Resident Profile
    $stmt = $db->prepare("INSERT INTO resident_profiles (user_id, property_id, first_name, last_name, contact_number, resident_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING resident_id");
    $stmt->execute([
        $user_id,
        $property_id,
        $data->first_name,
        $data->last_name,
        $data->contact_number ?? null,
        $data->resident_type
    ]);
    $resident_id = $stmt->fetchColumn();

    if ($property_use === 'Airbnb') {
        $stmt = $db->prepare("\n            INSERT INTO airbnb_host_properties (property_id, host_resident_id, listing_status)\n            VALUES (?, ?, 'Active')\n            ON CONFLICT (property_id) DO UPDATE\n            SET host_resident_id = EXCLUDED.host_resident_id,\n                listing_status = 'Active',\n                updated_at = CURRENT_TIMESTAMP\n        ");
        $stmt->execute([$property_id, $resident_id]);
    } else {
        $stmt = $db->prepare("UPDATE airbnb_host_properties SET listing_status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE property_id = ?");
        $stmt->execute([$property_id]);
    }

    $db->commit();
    http_response_code(201);
    echo json_encode(array("message" => "Account successfully created!"));

} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(array("message" => "Failed to create account.", "error" => $e->getMessage()));
}
?>
