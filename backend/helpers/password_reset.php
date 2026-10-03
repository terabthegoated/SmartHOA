<?php

require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

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
    return (bool) (
        password_reset_env('GMAIL_SMTP_USER')
        && password_reset_env('GMAIL_SMTP_APP_PASSWORD')
        && password_reset_env('EMAIL_FROM')
    );
}

function password_reset_send_email(string $recipient, string $token): bool {
    $smtpUser = password_reset_env('GMAIL_SMTP_USER');
    $smtpPassword = preg_replace('/\s+/', '', (string) password_reset_env('GMAIL_SMTP_APP_PASSWORD'));
    $from = password_reset_env('EMAIL_FROM');
    $fromName = password_reset_env('EMAIL_FROM_NAME', 'SmartHOA');
    $appBaseUrl = rtrim(password_reset_env('APP_BASE_URL', 'https://smart-hoa-sigma.vercel.app'), '/');

    if (!password_reset_email_is_configured()) {
        error_log('SmartHOA password reset email is not configured: Gmail SMTP settings or EMAIL_FROM is missing.');
        return false;
    }

    if (!filter_var($smtpUser, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        error_log('SmartHOA password reset email is not configured with valid Gmail sender addresses.');
        return false;
    }

    if (strcasecmp($smtpUser, $from) !== 0) {
        error_log('SmartHOA password reset email sender must match the Gmail SMTP account.');
        return false;
    }

    $resetUrl = $appBaseUrl . '/reset-password?token=' . rawurlencode($token);
    $safeResetUrl = htmlspecialchars($resetUrl, ENT_QUOTES, 'UTF-8');
    $html = '<p>Hello,</p>'
        . '<p>We received a request to reset your SmartHOA password.</p>'
        . '<p><a href="' . $safeResetUrl . '">Reset my password</a></p>'
        . '<p>This secure link can be used once and expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>';

    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPassword;
        // Render could not establish a connection through Gmail's STARTTLS
        // port (587), so use Gmail's alternate implicit-TLS SMTP endpoint.
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port = 465;
        $mail->Timeout = 20;
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($from, $fromName);
        $mail->addAddress($recipient);
        $mail->isHTML(true);
        $mail->Subject = 'Reset your SmartHOA password';
        $mail->Body = $html;
        $mail->AltBody = "We received a request to reset your SmartHOA password. Open this link within 30 minutes: {$resetUrl}";
        $mail->send();
        return true;
    } catch (Exception $exception) {
        error_log('SmartHOA password reset email failed through Gmail SMTP: ' . substr($exception->getMessage(), 0, 300));
        return false;
    }
}
