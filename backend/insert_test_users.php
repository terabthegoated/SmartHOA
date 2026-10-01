<?php
require_once __DIR__ . '/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    // 1. Get Role IDs
    $stmt = $db->query("SELECT role_id, role_name FROM roles");
    $roles = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    
    $super_admin_id = array_search('Super Administrator', $roles);
    $homeowner_id = array_search('Homeowner', $roles);

    if (!$super_admin_id || !$homeowner_id) {
        die("Error: Roles not found. Did you run the full seed.sql?");
    }

    $password = 'password123';
    $hash = password_hash($password, PASSWORD_BCRYPT);

    // 2. Insert Super Admin
    $admin_email = 'admin@southwynd.com';
    $stmt = $db->prepare("INSERT INTO users (role_id, email, password_hash, is_verified, account_status) VALUES (?, ?, ?, TRUE, 'Active') RETURNING user_id");
    $stmt->execute([$super_admin_id, $admin_email, $hash]);
    $admin_user_id = $stmt->fetchColumn();

    $stmt = $db->prepare("INSERT INTO resident_profiles (user_id, first_name, last_name) VALUES (?, 'System', 'Administrator')");
    $stmt->execute([$admin_user_id]);

    // 3. Insert Homeowner
    $resident_email = 'resident@southwynd.com';
    $stmt = $db->prepare("INSERT INTO users (role_id, email, password_hash, is_verified, account_status) VALUES (?, ?, ?, TRUE, 'Active') RETURNING user_id");
    $stmt->execute([$homeowner_id, $resident_email, $hash]);
    $homeowner_user_id = $stmt->fetchColumn();

    $stmt = $db->prepare("INSERT INTO resident_profiles (user_id, first_name, last_name, resident_type) VALUES (?, 'John', 'Doe', 'Homeowner')");
    $stmt->execute([$homeowner_user_id]);

    echo "Successfully created test users!";
} catch (PDOException $e) {
    if ($e->getCode() == 23505) { // Unique violation
        echo "Users already exist in the database.";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
