# SmartHOA presentation deployment

This deployment separates the public website from the private PHP API:

- **Frontend:** Vercel (Vite PWA)
- **Backend:** Render Web Service (PHP + Apache + PostgreSQL driver)
- **Database:** existing Supabase PostgreSQL project

## 1. Deploy the API on Render

1. Sign in to Render and select **New > Web Service**.
2. Connect the `terabthegoated/SmartHOA` GitHub repository.
3. Use these settings:
   - **Name:** `smarthoa-api`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Docker`
   - **Plan:** `Free`
   - **Health Check Path:** `/`
4. Add these environment variables from the local `backend/.env` file. Keep their values private:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_SSLMODE` — use `require` for Supabase
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASS`
   - `JWT_SECRET`
5. Create the service and wait for the deploy to finish. Open the generated URL. It should show `"status":"running"`.

Copy this URL, for example: `https://smarthoa-api.onrender.com`.

> Render's Free web service may sleep after 15 minutes without requests. For a presentation, open the API URL one or two minutes before the demo to wake it up. Uploaded receipt and complaint files are temporary on the free service; do not rely on uploads surviving a redeploy until Supabase Storage is connected.

## 2. Deploy the website on Vercel

1. Sign in to Vercel and select **Add New > Project**.
2. Import `terabthegoated/SmartHOA` from GitHub.
3. Set **Root Directory** to `frontend`.
4. In **Environment Variables**, add:
   - Name: `VITE_API_BASE_URL`
   - Value: the Render API URL from step 1, without a trailing slash.
5. Click **Deploy**.

Vercel will build the installable PWA and give you a public HTTPS address. The `frontend/vercel.json` file keeps React pages working after refresh.

## 3. Presentation check

1. Open the Render API URL and verify it returns `status: running`.
2. Open the Vercel URL in an incognito/private browser window.
3. Log in with a demo account and test one resident action and one officer action.
4. On Android, build again with the deployed API URL before installing a presentation APK. The existing local Android build still points to the local development API until its build environment is changed.

## Security reminder

Never place `DB_PASS`, `JWT_SECRET`, Supabase database credentials, or Firebase service-account files in GitHub or in a Vite variable. Only `VITE_API_BASE_URL` belongs in Vercel because it is a public URL.
