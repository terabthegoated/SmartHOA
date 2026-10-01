# Web Push Setup for iPhone Home Screen SmartHOA

SmartHOA's Web Push implementation supports the Vercel PWA, including iPhones running iOS 16.4 or later when the app was installed using Safari's **Add to Home Screen**.

## 1. Run the database migration

Run `database/migrations/20261002_add_web_push_subscriptions.sql` in the Supabase SQL Editor. Keep Row Level Security enabled if Supabase asks.

## 2. Generate a VAPID key pair locally

From the SmartHOA project folder, run:

```powershell
php -r "require 'backend/vendor/autoload.php'; print_r(\Minishlink\WebPush\VAPID::createVapidKeys());"
```

It prints a `publicKey` and `privateKey`. Treat the private key as a password. Do not post it in GitHub or share it.

## 3. Configure the deployed services

In Render, add these environment variables and redeploy the `smarthoa-api` service:

```text
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:<a monitored SmartHOA support email>
```

In Vercel, add this environment variable for **Production** and redeploy the website:

```text
VITE_WEB_PUSH_PUBLIC_KEY=<the same publicKey>
```

## 4. Enable notifications on an iPhone

1. Update the installed Home Screen app by opening SmartHOA, then closing and reopening it after the Vercel deployment finishes.
2. Sign in and open **Settings**.
3. Tap **Turn on notifications** and choose **Allow** in the iPhone prompt.
4. Put SmartHOA in the background, then publish an announcement from an officer account to test.

The permission prompt must be initiated by the user's tap; iOS does not allow a site to request it automatically after sign-in.
