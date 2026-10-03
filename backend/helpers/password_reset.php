<?php

function password_reset_env(string $name, ?string $default = null): ?string {
    $value = getenv($name);
    if ($value !== false && $value !== '') {
        return trim($value);
    }

    $environmentValue = $_ENV[$name] ?? $default;
    return is_string($environmentValue) ? trim($environmentValue) : $environmentValue;
}

function password_reset_password_is_valid(string $password): bool {
    return (bool) preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$/', $password);
}

function password_reset_generic_message(): string {
    return 'If an account matches that email address, a password-reset link has been sent.';
}

function password_reset_email_is_configured(): bool {
    $relayUrl = password_reset_env('GOOGLE_APPS_SCRIPT_RELAY_URL');
    $relaySecret = password_reset_env('GOOGLE_APPS_SCRIPT_RELAY_SECRET');

    return is_string($relayUrl)
        && filter_var($relayUrl, FILTER_VALIDATE_URL)
        && str_starts_with(strtolower($relayUrl), 'https://')
        && is_string($relaySecret)
        && strlen($relaySecret) >= 24;
}

function password_reset_send_email(string $recipient, string $token): bool {
    $relayUrl = password_reset_env('GOOGLE_APPS_SCRIPT_RELAY_URL');
    $relaySecret = password_reset_env('GOOGLE_APPS_SCRIPT_RELAY_SECRET');
    $fromName = password_reset_env('EMAIL_FROM_NAME', 'SmartHOA');
    $appBaseUrl = rtrim(password_reset_env('APP_BASE_URL', 'https://smart-hoa-sigma.vercel.app'), '/');

    if (!password_reset_email_is_configured()) {
        error_log('SmartHOA password reset email is not configured: Google Apps Script relay settings are missing.');
        return false;
    }

    $resetUrl = $appBaseUrl . '/reset-password?token=' . rawurlencode($token);
    $safeResetUrl = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    $html = '<p>Hello,</p>'
        . '<p>We received a request to reset your SmartHOA password.</p>'
        . '<p><a href="' . $safeResetUrl . '">Reset my password</a></p>'
        . '<p>This secure link can be used once and expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>';

    $payload = json_encode([
        'secret' => $relaySecret,
        'recipient' => $recipient,
        'subject' => 'Reset your SmartHOA password',
        'textContent' => "We received a request to reset your SmartHOA password. Open this link within 30 minutes: {$resetUrl}",
        'htmlContent' => $html,
        'senderName' => $fromName,
    ], JSON_UNESCAPED_SLASHES);

    if ($payload === false) {
        error_log('SmartHOA password reset email could not create the relay request.');
        return false;
    }

    $request = curl_init($relayUrl);
    curl_setopt_array($request, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);

    $response = curl_exec($request);
    $statusCode = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
    $curlError = curl_error($request);
    curl_close($request);

    $result = is_string($response) ? json_decode($response, true) : null;
    if ($response === false || $statusCode < 200 || $statusCode >= 300 || !is_array($result) || ($result['ok'] ?? false) !== true) {
        $reason = $curlError !== '' ? $curlError : "HTTP {$statusCode}";
        error_log('SmartHOA password reset email failed through Google Apps Script relay: ' . substr($reason, 0, 300));
        return false;
    }

    return true;
}
