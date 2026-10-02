# Android notification build checklist

Use these steps whenever you create an Android APK that should receive SmartHOA notifications.

1. Confirm `frontend/android/app/google-services.json` is present on the computer doing the build. It stays local and must never be committed.
2. In `frontend`, copy `.env.android.example` to `.env.production`. This sets the deployed Render API address and enables native Android push in the compiled app.
3. Run `npm run build`, then `npx cap sync android`.
4. Open the Android folder in Android Studio and create a signed APK or app bundle. Install the new build as an update over the old app.
5. Open SmartHOA, allow the Android notification prompt, then sign in. This securely links the device to that account.
6. Test while the Android app is in the background by creating an announcement from an officer account.

If permission was denied, open Android Settings, find SmartHOA under Apps, enable Notifications, then sign out and sign in again.
