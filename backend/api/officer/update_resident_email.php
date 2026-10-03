<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed.']);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

if (!function_exists('apache_request_headers')) {
    function apache_request_headers(): array {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $headers[str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

$headers = apache_request_headers();
$authHeader = $headers['Authorization'] ?? '';

if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['message' => 'Access denied.']);
    exit();
}

try {
    $jwtSecret = $_ENV['JWT_SECRET'] ?? 'super_secret_smarthoa_key_2026_change_me';
    $decoded = JWT::decode($matches[1], new Key($jwtSecret, 'HS256'));
    $role = $decoded->data->role ?? '';

    if (!in_array($role, ['Super Administrator', 'HOA Officer'], true)) {
        http_response_code(403);
        echo json_encode(['message' => 'Only HOA administrators can update a resident email address.']);
        exit();
    }

    $data = json_decode(file_get_contents('php://input'));
    $residentId = trim((string) ($data->resident_id ?? ''));
    $email = strtolower(trim((string) ($data->email ?? '')));

    if ($residentId === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['message' => 'Enter a valid resident and email address.']);
        exit();
    }

    $database = new Database();
    $db = $database->getConnection();
    $db->beginTransaction();

    $findResident = $db->prepare('SELECT rp.user_id, u.email FROM resident_profiles rp JOIN users u ON u.user_id = rp.user_id WHERE rp.resident_id = ? FOR UPDATE');
    $findResident->execute([$residentId]);
    $resident = $findResident->fetch(PDO::FETCH_ASSOC);

    if (!$resident) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['message' => 'Resident not found.']);
        exit();
    }

    $userId = $resident['user_id'];
    if (strcasecmp($resident['email'], $email) === 0) {
        $db->commit();
        echo json_encode(['message' => 'This resident already uses that email address.']);
        exit();
    }

    $emailInUse = $db->prepare('SELECT 1 FROM users WHERE LOWER(email) = ? AND user_id <> ? LIMIT 1');
    $emailInUse->execute([$email, $userId]);
    if ($emailInUse->fetchColumn()) {
        $db->rollBack();
        http_response_code(409);
        echo json_encode(['message' => 'That email address is already used by another SmartHOA account.']);
        exit();
    }

    $updateEmail = $db->prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    $updateEmail->execute([$email, $userId]);

    // Prevent a reset link sent to the old email address from being used.
    $invalidateTokens = $db->prepare('DELETE FROM password_reset_tokens WHERE user_id = ?');
    $invalidateTokens->execute([$userId]);

    $db->commit();
    echo json_encode(['message' => 'Resident email updated. Any older password-reset links have been cancelled.']);
} catch (Throwable $exception) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('SmartHOA resident email update failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Unable to update the resident email. Please try again.']);
}
