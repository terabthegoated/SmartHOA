<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->email) && !empty($data->password)) {
    // Query updated for PostgreSQL schema v1.0
    $query = "
        SELECT 
            u.user_id, 
            u.password_hash, 
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
    $email = htmlspecialchars(strip_tags($data->email));
    $stmt->bindParam(1, $email);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row['account_status'] !== 'Active') {
            http_response_code(403);
            echo json_encode(array("message" => "Account is " . $row['account_status'] . "."));
            exit();
        }

        // Verify the bcrypt hashed password
        if (password_verify($data->password, $row['password_hash'])) {
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

            // Import the JWT class
            require_once __DIR__ . '/../../vendor/autoload.php';
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
            http_response_code(401);
            echo json_encode(array("message" => "Invalid password."));
        }
    } else {
        http_response_code(404);
        echo json_encode(array("message" => "User not found."));
    }
} else {
    http_response_code(400);
    echo json_encode(array("message" => "Incomplete data. Please provide email and password."));
}
?>