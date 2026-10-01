<?php

use Firebase\JWT\JWT;

/**
 * Firebase Cloud Messaging delivery for SmartHOA Android devices.
 * It is disabled until the server is configured with a Firebase service-account
 * JSON file, so notification creation never fails when FCM is unavailable.
 */
function fcm_environment_value($key) {
    $value = getenv($key);
    return $value !== false ? trim((string) $value) : trim((string) ($_ENV[$key] ?? ''));
}

function fcm_valid_service_account($account) {
    return is_array($account) && !empty($account['client_email']) && !empty($account['private_key']) && !empty($account['project_id'])
        ? $account
        : null;
}

function fcm_service_account() {
    // Render cannot read a JSON file kept on a developer's computer. For the
    // deployed API, store the service-account JSON as a base64 environment
    // value. The file path remains supported for local development.
    $encoded = fcm_environment_value('FCM_SERVICE_ACCOUNT_BASE64');
    if ($encoded !== '') {
        $json = base64_decode($encoded, true);
        if ($json !== false) {
            $account = fcm_valid_service_account(json_decode($json, true));
            if ($account) {
                return $account;
            }
        }
    }

    $path = fcm_environment_value('FCM_SERVICE_ACCOUNT_PATH');
    if ($path === '' || !is_readable($path)) {
        return null;
    }
    return fcm_valid_service_account(json_decode(file_get_contents($path), true));
}

function fcm_post($url, $body, $headers) {
    if (!function_exists('curl_init')) {
        throw new Exception('PHP cURL is required for Firebase Cloud Messaging.');
    }
    $curl = curl_init($url);
    curl_setopt_array($curl, array(
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12
    ));
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($response === false) {
        throw new Exception('Firebase request failed: ' . $error);
    }
    return array($status, $response);
}

function fcm_access_token($account) {
    $now = time();
    $assertion = JWT::encode(array(
        'iss' => $account['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => $account['token_uri'] ?? 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600
    ), $account['private_key'], 'RS256');

    list($status, $response) = fcm_post(
        $account['token_uri'] ?? 'https://oauth2.googleapis.com/token',
        http_build_query(array(
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $assertion
        )),
        array('Content-Type: application/x-www-form-urlencoded')
    );
    $payload = json_decode($response, true);
    if ($status < 200 || $status >= 300 || empty($payload['access_token'])) {
        throw new Exception('Unable to obtain a Firebase access token.');
    }
    return $payload['access_token'];
}

function send_fcm_push(PDO $db, array $recipientIds, $title, $message, $notificationType, $targetPath) {
    $account = fcm_service_account();
    if (!$account || count($recipientIds) === 0) {
        return array('configured' => false, 'sent' => 0);
    }

    try {
        $recipientIds = array_values(array_unique(array_filter($recipientIds)));
        $placeholders = implode(',', array_fill(0, count($recipientIds), '?'));
        $stmt = $db->prepare("SELECT device_id, fcm_token FROM push_devices WHERE is_enabled = TRUE AND user_id IN ($placeholders)");
        $stmt->execute($recipientIds);
        $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($devices) === 0) {
            return array('configured' => true, 'sent' => 0);
        }

        $accessToken = fcm_access_token($account);
        $sent = 0;
        foreach ($devices as $device) {
            $payload = array('message' => array(
                'token' => $device['fcm_token'],
                'notification' => array('title' => $title, 'body' => $message),
                'data' => array('type' => (string) $notificationType, 'target_path' => (string) $targetPath),
                'android' => array('priority' => 'high')
            ));
            list($status, $response) = fcm_post(
                'https://fcm.googleapis.com/v1/projects/' . rawurlencode($account['project_id']) . '/messages:send',
                json_encode($payload),
                array('Authorization: Bearer ' . $accessToken, 'Content-Type: application/json')
            );
            if ($status >= 200 && $status < 300) {
                $sent++;
                continue;
            }
            if ($status === 404 || strpos($response, 'UNREGISTERED') !== false) {
                $disable = $db->prepare("UPDATE push_devices SET is_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE device_id = ?");
                $disable->execute([$device['device_id']]);
            }
        }
        return array('configured' => true, 'sent' => $sent);
    } catch (Exception $e) {
        error_log('SmartHOA FCM delivery skipped: ' . $e->getMessage());
        return array('configured' => true, 'sent' => 0, 'error' => $e->getMessage());
    }
}
