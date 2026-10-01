import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '../config/api';

const publicVapidKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ?? '';

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function canUseWebPush() {
  return !Capacitor.isNativePlatform()
    && Boolean(publicVapidKey)
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

async function saveSubscription(subscription: PushSubscription, sessionToken: string) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('This browser did not provide a valid notification subscription.');
  }

  await axios.post(`${API_BASE_URL}/api/shared/register_web_push_subscription.php`, {
    endpoint: json.endpoint,
    expiration_time: json.expirationTime,
    keys: { p256dh, auth }
  }, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });
}

/**
 * Reconnects a previously approved browser subscription after sign-in. This
 * never displays a permission prompt, which is important on iPhone PWAs.
 */
export async function syncWebPushSubscription(sessionToken: string) {
  if (!canUseWebPush() || Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  await saveSubscription(subscription, sessionToken);
  return true;
}

/**
 * Must be called from a user tap. iPhone Home Screen apps do not allow a
 * website to request notification permission automatically after login.
 */
export async function enableWebPushNotifications(sessionToken: string) {
  if (Capacitor.isNativePlatform()) {
    throw new Error('Device notifications are managed by the native app.');
  }
  if (!publicVapidKey) {
    throw new Error('Device notifications are still being configured. Please try again shortly.');
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('This browser does not support device notifications. On iPhone, open SmartHOA from its Home Screen icon.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed. You can enable SmartHOA notifications later in your device settings.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicVapidKey)
    });
  }

  await saveSubscription(subscription, sessionToken);
  return true;
}

export function webPushPermission() {
  if (!canUseWebPush()) return 'unavailable';
  return Notification.permission;
}
