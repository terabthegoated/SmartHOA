<?php

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

function web_push_environment_value($key) {
    $value = getenv($key);
    return $value !== false ? trim((string) $value) : trim((string) ($_ENV[$key] ?? ''));
}

function web_push_configuration() {
    $publicKey = web_push_environment_value('VAPID_PUBLIC_KEY');
    $privateKey = web_push_environment_value('VAPID_PRIVATE_KEY');
    $subject = web_push_environment_value('VAPID_SUBJECT');

    if ($publicKey === '' || $privateKey === '' || $subject === '') {
        return null;
    }

    return array(
        'subject' => $subject,
        'publicKey' => $publicKey,
        'privateKey' => $privateKey
    );
}

function send_web_push(PDO $db, array $recipientIds, $title, $message, $notificationType, $targetPath) {
    $configuration = web_push_configuration();
    $recipientIds = array_values(array_unique(array_filter($recipientIds)));

    if (!$configuration || count($recipientIds) === 0) {
        return array('configured' => false, 'sent' => 0);
    }

    try {
        $placeholders = implode(',', array_fill(0, count($recipientIds), '?'));
        $stmt = $db->prepare("SELECT subscription_id, endpoint, p256dh_key, auth_key FROM web_push_subscriptions WHERE is_enabled = TRUE AND user_id IN ($placeholders)");
        $stmt->execute($recipientIds);
        $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (count($subscriptions) === 0) {
            return array('configured' => true, 'sent' => 0);
        }

        $webPush = new WebPush(array('VAPID' => $configuration), array('TTL' => 86400, 'urgency' => 'high'));
        $payload = json_encode(array(
            'title' => (string) $title,
            'body' => (string) $message,
            'type' => (string) $notificationType,
            'target_path' => (string) $targetPath
        ));
        $sent = 0;

        foreach ($subscriptions as $storedSubscription) {
            $subscription = Subscription::create(array(
                'endpoint' => $storedSubscription['endpoint'],
                'publicKey' => $storedSubscription['p256dh_key'],
                'authToken' => $storedSubscription['auth_key'],
                'contentEncoding' => 'aes128gcm'
            ));
            $report = $webPush->sendOneNotification($subscription, $payload);

            if ($report->isSuccess()) {
                $sent++;
            } elseif ($report->isSubscriptionExpired()) {
                $disable = $db->prepare("UPDATE web_push_subscriptions SET is_enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE subscription_id = ?");
                $disable->execute([$storedSubscription['subscription_id']]);
            }
        }

        return array('configured' => true, 'sent' => $sent);
    } catch (Exception $e) {
        error_log('SmartHOA web push delivery skipped: ' . $e->getMessage());
        return array('configured' => true, 'sent' => 0, 'error' => $e->getMessage());
    }
}
