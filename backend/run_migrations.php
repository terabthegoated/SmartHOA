<?php
include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    $schema = file_get_contents('../database/schema.sql');
    $db->exec($schema);
    echo "Schema executed.\n";

    $seed = file_get_contents('../database/seed.sql');
    $db->exec($seed);
    echo "Seed executed.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
