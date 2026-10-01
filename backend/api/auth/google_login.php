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

$data = json_decode(file_get_contents("php://input"));

if (empty($data->access_token)) {
    http_response_code(400);
    echo json_encode(array("message" => "Access token is required."));
    exit();
}

// Verify token with Google
$google_api_url = "https://www.googleapis.com/oauth2/v3/userinfo?access_token=" . $data->access_token;
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $google_api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$response = curl_exec($ch);
curl_close($ch);

$google_user = json_decode($response);

if (empty($google_user->email)) {
    http_response_code(401);
    echo json_encode(array("message" => "Invalid Google Token."));
    exit();
}

$email = $google_user->email;

$database = new Database();
$db = $database->getConnection();

$query = "
    SELECT 
        u.user_id, 
        u.account_status, 
        r.role_name, 
        rp.first_name, 
        rp.last_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.role_id
    LEFT JOIN resident_profiles rp ON u.user_id = rp.user_id
    WHERE u.email = ?
    LIMIT 1
";

$stmt = $db->prepare($query);
$stmt->execute([$email]);

if ($stmt->rowCount() > 0) {
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row['account_status'] !== 'Active') {
        http_response_code(403);
        echo json_encode(array("message" => "Account is " . $row['account_status'] . "."));
        exit();
    }

    // Update last_login
    $update_query = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?";
    $update_stmt = $db->prepare($update_query);
    $update_stmt->execute([$row['user_id']]);

    // Create JWT Token using firebase/php-jwt
    $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $issued_at = time();
    $expiration_time = $issued_at + (3600 * ($_ENV['JWT_EXPIRATION_HOURS'] ?? 24)); // Valid for 24 hours
    
    $payload = array(
        "iat" => $issued_at,
        "exp" => $expiration_time,
        "data" => array(
            "user_id" => $row['user_id'],
            "role" => $row['role_name'],
            "email" => $email
        )
    );

    $jwt = \Firebase\JWT\JWT::encode($payload, $jwt_secret, 'HS256');

    http_response_code(200);
    echo json_encode(array(
        "message" => "Login successful.",
        "token" => $jwt,
        "user" => array(
            "id" => $row['user_id'],
            "name" => trim($row['first_name'] . ' ' . $row['last_name']),
            "email" => $email,
            "role" => $row['role_name']
        )
    ));
} else {
    // ACCOUNT DOES NOT EXIST -> AUTO REGISTER
    try {
        $db->beginTransaction();

        // 1. Get Role ID for Homeowner
        $stmt = $db->prepare("SELECT role_id FROM roles WHERE role_name = 'Homeowner'");
        $stmt->execute();
        $role_id = $stmt->fetchColumn();

        if (!$role_id) {
            throw new Exception("Default role not found.");
        }

        // 2. Create User
        $random_password = bin2hex(random_bytes(16)); // Random strong password
        $password_hash = password_hash($random_password, PASSWORD_BCRYPT);
        
        $stmt = $db->prepare("INSERT INTO users (role_id, email, password_hash, is_verified, account_status) VALUES (?, ?, ?, TRUE, 'Active') RETURNING user_id");
        $stmt->execute([$role_id, $email, $password_hash]);
        $new_user_id = $stmt->fetchColumn();

        // 3. Create Resident Profile
        $first_name = $google_user->given_name ?? 'Resident';
        $last_name = $google_user->family_name ?? '';
        
        $stmt = $db->prepare("INSERT INTO resident_profiles (user_id, first_name, last_name, resident_type) VALUES (?, ?, ?, 'Homeowner')");
        $stmt->execute([$new_user_id, $first_name, $last_name]);

        $db->commit();

        // 4. Generate JWT for new user
        $jwt_secret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
        $issued_at = time();
        $expiration_time = $issued_at + (3600 * ($_ENV['JWT_EXPIRATION_HOURS'] ?? 24));
        
        $payload = array(
            "iat" => $issued_at,
            "exp" => $expiration_time,
            "data" => array(
                "user_id" => $new_user_id,
                "role" => 'Homeowner',
                "email" => $email
            )
        );

        $jwt = \Firebase\JWT\JWT::encode($payload, $jwt_secret, 'HS256');

        http_response_code(200);
        echo json_encode(array(
            "message" => "Account created and logged in.",
            "token" => $jwt,
            "user" => array(
                "id" => $new_user_id,
                "name" => trim($first_name . ' ' . $last_name),
                "email" => $email,
                "role" => 'Homeowner'
            )
        ));

    } catch (Exception $e) {
        $db->rollBack();
        http_response_code(500);
        echo json_encode(array("message" => "Failed to auto-register Google account.", "error" => $e->getMessage()));
    }
}
?>
