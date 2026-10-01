<?php
$host = 'aws-0-ap-southeast-2.pooler.supabase.com';
$port = '6543';
$dbname = 'postgres';
$user = 'postgres.irqvapujcvddzssygkfm';
$password = 'SmartHOAResidences-1';

$dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
try {
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "Connected successfully to pooler!\n";
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
}
