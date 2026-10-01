<?php
// Lightweight Render health check. It intentionally exposes no database,
// account, or configuration information.
header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
    'name' => 'SmartHOA API',
    'status' => 'running'
]);
?>
