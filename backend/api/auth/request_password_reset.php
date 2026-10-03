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
$email = strtolower(trim((string) ($data->email ?? '')));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['message' => 'Enter a valid email address.']);
    exit();
}

$database = new Database();

if (!password_reset_email_is_configured()) {
    error_log('SmartHOA password reset email is not configured: BREVO_API_KEY or EMAIL_FROM is missing.');
    http_response_code(503);
    echo json_encode(['message' => 'Password-reset email is temporarily unavailable. Please contact the HOA office.']);
    exit();
}

$db = $database->getConnection();

try {
    $userStatement = $db->prepare("SELECT user_id FROM users WHERE LOWER(email) = ? AND account_status = 'Active' LIMIT 1");
    $userStatement->execute([$email]);
    $userId = $userStatement->fetchColumn();

    // Return the same message whether or not a matching account exists. This
    // prevents anyone from using this screen to discover resident accounts.
    if (!$userId) {
        echo json_encode(['message' => password_reset_generic_message()]);
        exit();
    }

    $recentStatement = $db->prepare("SELECT 1 FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds' LIMIT 1");
    $recentStatement->execute([$userId]);
    if ($recentStatement->fetchColumn()) {
        echo json_encode(['message' => password_reset_generic_message()]);
        exit();
    }

    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    $db->beginTransaction();
    $expireOldTokens = $db->prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL');
    $expireOldTokens->execute([$userId]);

    $createToken = $db->prepare("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '30 minutes')");
    $createToken->execute([$userId, $tokenHash]);
    $db->commit();

    if (!password_reset_send_email($email, $token)) {
        // Do not retain a token that never reached the resident's inbox.
        $deleteToken = $db->prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?');
        $deleteToken->execute([$tokenHash]);
    }

    echo json_encode(['message' => password_reset_generic_message()]);
} catch (Throwable $exception) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log('SmartHOA password reset request failed: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Unable to process the password-reset request. Please try again later.']);
}
