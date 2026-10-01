<?php
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$root = __DIR__;
chdir($root . '/backend');

if ($uri === '/' || $uri === '') {
    header('Content-Type: application/json');
    echo json_encode([
        'name' => 'SmartHOA API',
        'status' => 'running',
        'message' => 'Backend server is ready.'
    ]);
    return;
}

$target = $root . '/backend' . $uri;

if (file_exists($target) && is_file($target)) {
    require $target;
    return;
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['message' => 'Route not found: ' . $uri]);
