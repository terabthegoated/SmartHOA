import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

let currentSessionToken: string | null = null;
let listenersReady = false;

function reportNativePushStatus(message: string, isError = false) {
  window.dispatchEvent(new CustomEvent('smarthoa-native-push-status', {
    detail: { message, isError }
  }));
}

async function saveDeviceToken(fcmToken: string) {
  if (!currentSessionToken) return;
  await axios.post(`${API_BASE_URL}/api/shared/register_push_device.php`, {
    fcm_token: fcmToken,
    platform: Capacitor.getPlatform()
  }, {
    headers: { Authorization: `Bearer ${currentSessionToken}` }
  });
}

/**
 * Requests the user's permission only after sign-in, then links the device's
 * Firebase token to that SmartHOA account. It is intentionally a no-op in the
 * browser; browser web push is configured separately at deployment time.
 */
export async function registerNativePushNotifications(sessionToken: string) {
  // Native push requires a Firebase Android configuration.  Keep it opt-in so
  // an emulator build can use every normal SmartHOA feature before Firebase is
  // connected; without this guard the Android plugin terminates the app.
  if (
    !Capacitor.isNativePlatform() ||
    import.meta.env.VITE_ENABLE_NATIVE_PUSH !== 'true'
  ) {
    return {
      message: 'This app update does not have Android notifications enabled. Install the newest SmartHOA app and try again.',
      isError: true
    };
  }
  currentSessionToken = sessionToken;

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      return {
        message: 'Notifications are not allowed yet. Enable SmartHOA notifications in Android Settings, then try again.',
        isError: true
      };
    }

    // Android 8+ lets users control this "SmartHOA Alerts" category in their
    // system settings. A high-importance channel makes new announcements and
    // account updates visible as alerts rather than silent background items.
    await PushNotifications.createChannel({
      id: 'smarthoa_alerts',
      name: 'SmartHOA Alerts',
      description: 'Announcements, payments, reminders, and complaint updates',
      importance: 4,
      visibility: 1,
      vibration: true
    });

    if (!listenersReady) {
      await PushNotifications.addListener('registration', async (token) => {
        try {
          await saveDeviceToken(token.value);
          reportNativePushStatus('This Android phone is connected and can receive SmartHOA notifications.');
        } catch (error) {
          console.error('Unable to save the push device token.', error);
          reportNativePushStatus('Android gave SmartHOA a device token, but it could not be saved. Check your internet connection and try again.', true);
        }
      });
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push notification registration failed.', error);
        reportNativePushStatus('Android could not create a notification token. Check your internet connection and try again.', true);
      });
      listenersReady = true;
    }

    await PushNotifications.register();
    return {
      message: 'Android permission is enabled. Connecting this phone to SmartHOA…',
      isError: false
    };
  } catch (error) {
    // A missing Firebase config should not block normal application sign-in.
    console.error('Push notification setup is unavailable.', error);
    return {
      message: 'Unable to start Android notifications. Please try again after checking your internet connection.',
      isError: true
    };
  }
}
