<?php
require_once __DIR__ . '/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

$query = "SELECT email, password_hash FROM users";
$stmt = $db->prepare($query);
$stmt->execute();
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

print_r($users);
?>
