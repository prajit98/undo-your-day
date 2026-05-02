# Undo Production Checklist

This file is the shortest path from the current repo to a real App Store / Play Store launch.

## 1. Backend

Before launch:

- create separate Supabase projects for dev, staging, and production
- apply `supabase/migrations/20260422_undo_foundation.sql`
- apply `supabase/migrations/20260423_gmail_mvp.sql`
- apply `supabase/migrations/20260424_candidate_items.sql`
- enable email/password auth
- set the production environment variables from `.env.example`
- set the production Edge Function secrets from `supabase/functions/.env.example`
- set `GMAIL_TOKEN_ENCRYPTION_KEY` before deploying Gmail functions
- verify RLS policies in production
- turn on database backups

Do not ship with:

- `VITE_USE_LOCAL_ADAPTER=true`
- missing Supabase keys
- missing `GMAIL_TOKEN_ENCRYPTION_KEY` once Gmail is enabled

Generate `GMAIL_TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.
Existing plaintext Gmail refresh tokens are still readable for rollout safety, but new OAuth writes and successful refreshes store the encrypted `enc:v1:` format.

## 2. Native shell

Before internal testing:

- set your real bundle id in `capacitor.config.json`
- run `npm run build:native`
- open Android Studio with `npm run cap:open:android`
- open Xcode on a Mac with `npm run cap:open:ios`
- add real app icons, launch screen assets, and signing

## 3. Store compliance

Before review:

- add a real privacy policy URL
- add an account deletion flow in-app
- add a public account deletion URL for Google Play
- complete App Privacy details in App Store Connect
- complete Data Safety in Play Console

## 4. Product trust

Do not publicly launch until these are true:

- Gmail detection is real, or the Gmail onboarding/connected copy is hidden
- reminder settings match real reminder delivery
- auth and persistence have been tested across logout, reinstall, and multi-device sign-in

Undo is a trust product. Simulated Gmail detection should not ship as if it were real.

## 5. QA

Run a full pass for:

- sign up
- log in
- log out
- onboarding completion and replay
- item creation
- done and archive state
- reminder persistence after reload
- free-tier limit after reload
- premium state persistence
- weekly recap after reload

## 6. Launch order

Recommended:

1. ship staging to internal testers
2. TestFlight + Play internal testing
3. fix auth/persistence/reminder trust issues
4. submit for review
5. soft launch before public launch day
