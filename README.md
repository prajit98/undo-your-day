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
3. Enable email/password auth
4. Add your production site URL and any preview URLs to Supabase Auth redirect settings
5. Put the production anon key and URL into your app environment

Important:

- Do not ship a production build with `VITE_USE_LOCAL_ADAPTER=true`
- Production builds should use the Supabase adapter only

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
