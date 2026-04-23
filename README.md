# Undo

Undo is a mobile-first mistake-prevention app. It helps people catch small life mistakes before they turn expensive, stressful, or awkward.

This repo now includes:

- the web app
- a Supabase-ready persistence/auth layer
- Capacitor setup for iOS and Android app shells

## Local development

1. Copy `.env.example` to `.env.local`
2. Add your Supabase keys if you want the real backend
3. Install dependencies
4. Run `npm run dev`

If Supabase keys are missing, Undo can still run in local adapter mode during development.

## Environment variables

Required for production:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL`
- `VITE_PRIVACY_POLICY_URL`
- `VITE_ACCOUNT_DELETION_URL`

Helpful:

- `VITE_SUPPORT_EMAIL`

Development only:

- `VITE_USE_LOCAL_ADAPTER=true`

## Supabase setup

1. Create a Supabase project for each environment you need:
   - development
   - staging
   - production
2. Apply the SQL in `supabase/migrations/20260422_undo_foundation.sql`
3. Apply the SQL in `supabase/migrations/20260423_gmail_mvp.sql`
4. Enable email/password auth
5. Add your production site URL and any preview URLs to Supabase Auth redirect settings
6. Put the production anon key and URL into your app environment

Important:

- Do not ship a production build with `VITE_USE_LOCAL_ADAPTER=true`
- Production builds should use the Supabase adapter only

## Gmail setup

Undo's Gmail MVP uses Supabase Edge Functions so OAuth tokens stay off the client.

1. In Google Cloud, enable the Gmail API.
2. Create a Web application OAuth client.
3. Add the redirect URI for your Supabase callback function:
   - `https://<your-project-ref>.supabase.co/functions/v1/gmail-callback`
4. Set these Supabase Edge Function secrets from `supabase/functions/.env.example`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
   - `APP_PUBLIC_URL`
5. Deploy these functions:
   - `gmail-authorize`
   - `gmail-callback`
   - `gmail-sync`
   - `gmail-disconnect`

The Gmail scope for this MVP is read-only and Undo still sends every match through review before anything is kept.

## Native app shell

Undo uses Capacitor as the lightest path from the current Vite app to iOS and Android.

Useful commands:

- `npm run build:native`
- `npm run cap:sync`
- `npm run cap:open:android`
- `npm run cap:open:ios`

Bundle id currently defaults to `com.undoyourday.app` in `capacitor.config.json`.
Before release, replace it with the reverse-domain id you actually own.

## Release notes

For the production checklist and store-readiness work, see [PRODUCTION.md](./PRODUCTION.md).
