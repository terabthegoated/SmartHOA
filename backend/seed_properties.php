<?php
require_once __DIR__ . '/vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

include_once __DIR__ . '/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    $properties = [
        ['1', '1'], ['1', '2'], ['1', '3'],
        ['2', '1'], ['2', '2'], ['2', '3']
    ];

    $stmt = $db->prepare("INSERT INTO properties (block, lot) VALUES (?, ?) ON CONFLICT (block, lot) DO NOTHING");
    
    foreach ($properties as $prop) {
        $stmt->execute([$prop[0], $prop[1]]);
    }
    echo "Successfully seeded dummy properties!";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
