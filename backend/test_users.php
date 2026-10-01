<?php
include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();
$stmt = $db->query("SELECT email FROM users");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
