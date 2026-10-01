import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

let currentSessionToken: string | null = null;
let listenersReady = false;

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
  ) return;
  currentSessionToken = sessionToken;

  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return;

    if (!listenersReady) {
      await PushNotifications.addListener('registration', async (token) => {
        try {
          await saveDeviceToken(token.value);
        } catch (error) {
          console.error('Unable to save the push device token.', error);
        }
      });
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push notification registration failed.', error);
      });
      listenersReady = true;
    }

    await PushNotifications.register();
  } catch (error) {
    // A missing Firebase config should not block normal application sign-in.
    console.error('Push notification setup is unavailable.', error);
  }
}
