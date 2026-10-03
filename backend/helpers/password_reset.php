<?php

function password_reset_env(string $name, ?string $default = null): ?string {
    $value = getenv($name);
    if ($value !== false && $value !== '') {
        return $value;
    }

    return $_ENV[$name] ?? $default;
}

function password_reset_password_is_valid(string $password): bool {
    return (bool) preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$/', $password);
}

function password_reset_generic_message(): string {
    return 'If an account matches that email address, a password-reset link has been sent.';
}

function password_reset_email_is_configured(): bool {
    return (bool) (password_reset_env('BREVO_API_KEY') && password_reset_env('EMAIL_FROM'));
}

function password_reset_send_email(string $recipient, string $token): bool {
    $apiKey = password_reset_env('BREVO_API_KEY');
    $from = password_reset_env('EMAIL_FROM');
    $fromName = password_reset_env('EMAIL_FROM_NAME', 'SmartHOA');
    $appBaseUrl = rtrim(password_reset_env('APP_BASE_URL', 'https://smart-hoa-sigma.vercel.app'), '/');

    if (!password_reset_email_is_configured()) {
        error_log('SmartHOA password reset email is not configured: BREVO_API_KEY or EMAIL_FROM is missing.');
        return false;
    }

    if (!function_exists('curl_init')) {
        error_log('SmartHOA password reset email could not be sent: PHP cURL is unavailable.');
        return false;
    }

    $resetUrl = $appBaseUrl . '/reset-password?token=' . rawurlencode($token);
    $safeResetUrl = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    $html = '<p>Hello,</p>'
        . '<p>We received a request to reset your SmartHOA password.</p>'
        . '<p><a href="' . $safeResetUrl . '">Reset my password</a></p>'
        . '<p>This secure link can be used once and expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>';

    $payload = json_encode([
        'sender' => [
            'name' => $fromName,
            'email' => $from,
        ],
        'to' => [[
            'email' => $recipient,
        ]],
        'subject' => 'Reset your SmartHOA password',
        'html' => $html,
    ]);

    $curl = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'api-key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($response === false || $status < 200 || $status >= 300) {
        error_log('SmartHOA password reset email failed with HTTP ' . $status . ($error ? ': ' . $error : '.'));
        return false;
    }

    return true;
}
