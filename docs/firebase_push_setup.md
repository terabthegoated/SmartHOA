# Firebase Push Notification Setup

SmartHOA is wired to request Android notification permission after sign-in, store the device token in `push_devices`, and deliver pushes for announcements, payment approvals, and complaint status updates. Complete these steps to activate delivery.

## 1. Create the Firebase Android app

1. Open the [Firebase Console](https://console.firebase.google.com/), then create or select a Firebase project.
2. Add an Android app with this package name exactly: `com.southwynd.smarthoa`.
3. Download the generated `google-services.json` file.
4. Put it at `frontend/android/app/google-services.json`.

The file is ignored by Git. Do not post or share it in a public repository.

## 2. Configure the SmartHOA backend

1. In Firebase Project Settings, open **Service accounts**.
2. Generate a new private key and save the downloaded JSON file at `backend/secrets/firebase-service-account.json`.
3. Add this value to `backend/.env`, using your own absolute path:

```text
FCM_SERVICE_ACCOUNT_PATH=C:/Users/Jorell/Downloads/SmartHOA-1/backend/secrets/firebase-service-account.json
```

The service-account file authorizes the server to send FCM notifications. Keep it private and never upload it to GitHub.

## 3. Rebuild the Android app

Close the emulator first if the computer is low on memory, then run from `frontend/`:

```powershell
npm run build
npx cap sync android
```

Open Android Studio again, run the app, sign in, and allow the notification permission. The device token will be recorded in the `push_devices` table.

## 4. Test a real notification

With the app installed and signed in on the emulator or an Android phone:

1. Keep the resident app in the background.
2. Sign in as an officer in another session.
3. Publish an announcement, approve a payment, or update a complaint.
4. SmartHOA will save the normal in-app notification and send an FCM device push to the affected signed-in user.

Firebase Cloud Messaging requires Android notification permission on Android 13 and later. The app requests it after sign-in.
