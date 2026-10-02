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
require_once __DIR__ . '/../../helpers/password_reset.php';

$data = json_decode(file_get_contents('php://input'));
$token = (string) ($data->token ?? '');
$password = (string) ($data->password ?? '');

if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
    http_response_code(400);
    echo json_encode(['message' => 'This password-reset link is invalid or has expired.']);
    exit();
}

if (!password_reset_password_is_valid($password)) {
    http_response_code(400);
    echo json_encode(['message' => 'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character such as _ or !.']);
    exit();
}

$database = new Database();
$db = $database->getConnection();

try {
    $db->beginTransaction();

    $tokenHash = hash('sha256', $token);
    $tokenStatement = $db->prepare('SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE');
    $tokenStatement->execute([$tokenHash]);
    $userId = $tokenStatement->fetchColumn();

    if (!$userId) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['message' => 'This password-reset link is invalid or has expired.']);
        exit();
    }

    $newPasswordHash = password_hash($password, PASSWORD_BCRYPT);
    $updatePassword = $db->prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    $updatePassword->execute([$newPasswordHash, $userId]);

    // Mark every active reset token for this account as used, including the
    // one above, so a link cannot be replayed.
    $expireTokens = $db->prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL');
    $expireTokens->execute([$userId]);

    $db->commit();
    echo json_encode(['message' => 'Your password has been reset. You can now log in.']);
} catch (Throwable $exception) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log('SmartHOA password reset failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Unable to reset the password. Please try again later.']);
}
