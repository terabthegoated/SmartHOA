# Password-reset email relay with Google Apps Script

This relay sends SmartHOA password-reset emails from the Gmail account that
owns the Apps Script project. It is intended for the low volume of password
reset messages, and avoids the outbound SMTP connection block on Render. The
script uses `MailApp`, which requests permission to send email only; it does
not need access to read or delete messages in the Gmail mailbox.

## Google Apps Script setup

1. Sign in to the Gmail account that should send SmartHOA emails.
2. Open https://script.google.com/home and create a **New project**.
3. Replace the starter code with the contents of
   `google_apps_script_password_reset_relay.js`, then save the project.
4. In **Project Settings**, add a Script property:
   - Property: `SMART_HOA_RELAY_SECRET`
   - Value: a new random secret with at least 24 characters.
5. Select **Deploy** > **New deployment** > **Web app**.
   - Execute as: **Me**
   - Who has access: the least-open option that still allows Render to call
     the endpoint (normally **Anyone**).
6. Deploy, complete Google's authorization request for sending email, and
   copy the Web app URL ending in `/exec`.

## Render settings

Add these environment variables to the `smarthoa-api` Render service, then
save them and wait for a successful deploy:

```text
GOOGLE_APPS_SCRIPT_RELAY_URL=<the Web app URL ending in /exec>
GOOGLE_APPS_SCRIPT_RELAY_SECRET=<the exact Script property value>
EMAIL_FROM_NAME=SmartHOA
```

Keep the URL and secret private. Do not put either value in source code, a
GitHub commit, screenshots, or chat messages.

The old `GMAIL_SMTP_USER` and `GMAIL_SMTP_APP_PASSWORD` settings are no
longer used by SmartHOA and may be removed from Render after this relay works.
