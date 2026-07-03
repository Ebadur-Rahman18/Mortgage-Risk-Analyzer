# Edge Function Secrets Required

Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/settings/functions

Add these secrets if missing:

## 1. SUPABASE_URL
Value: https://spppmtgzugvknfqeyjqq.supabase.co

## 2. SUPABASE_SERVICE_ROLE_KEY
Value: [Your service role key from Settings > API]

To find your service role key:
1. Go to: https://supabase.com/dashboard/project/spppmtgzugvknfqeyjqq/settings/api
2. Look for "service_role" key (NOT anon key)
3. Click "Reveal" and copy it
4. Add it as a secret in Functions settings

## Zoom (`sync-zoom-files`, `validate-api-key` for provider `zoom`)

- **`ZOOM_CLIENT_ID`**, **`ZOOM_CLIENT_SECRET`**, **`ZOOM_ACCOUNT_ID`** — Server-to-Server OAuth app credentials from the [Zoom Marketplace](https://marketplace.zoom.us/). Required if you do **not** store credentials in **`integration_settings`** (`provider_name = 'zoom'`) via Admin → Integrations → Meeting providers.
- **`ZOOM_SYNC_USER_ID`** (optional if set in integration config as `sync_user_id`) — Zoom user id **or** email for `GET /users/{userId}/recordings` (the user whose cloud recordings you sync).

`zoom-disconnect` only needs standard Supabase secrets (URL, anon, service role).

## Borrower portal functions (`portal-*`)

- **`PORTAL_JWT_SECRET`** (optional) — long random string (e.g. 32+ bytes hex) used to sign borrower portal session JWTs. If unset, the functions derive an HS256 key from **`SUPABASE_SERVICE_ROLE_KEY`** (already provided by Supabase), so `portal-redeem-invite`, `portal-loan-summary`, and `portal-submit-upload` work without extra secrets. Set this when you want a dedicated secret or to rotate portal tokens independently of the service role.
- **`BORROWER_PORTAL_APP_URL`** (optional) — public origin for invite links, e.g. `https://app.yourdomain.com`. Defaults to `SITE_URL` or `http://localhost:5173` in `portal-create-invite`.

## Notifications (`send-notification`, `send-feedback-notification`)

Optional if SendGrid credentials are stored in **Admin → Integrations → Communication** (`integration_settings` row `sendgrid`):

- **`SENDGRID_API_KEY`** — SendGrid API key for transactional email.
- **`SENDGRID_FROM_EMAIL`** — Default **From** address (must be verified in SendGrid). Can be set per deployment instead of integration `config.from_email`.
- **`SENDGRID_FROM_NAME`** — Optional display name for the From field.
- **`SITE_URL`** — Public app origin (e.g. `https://app.example.com`) when referenced by edge functions. Optional.

## Note
These are automatically available in most cases, but if the edge function 
can't access the database, they might be missing.
