# Prayer alert backend (Cloud Functions gen2)

Web Push backend for prayer-time notifications. Three HTTP functions on GCP
project `blitz-ksa`, region `us-central1`, plus Firestore + Cloud Scheduler.

- **subscribe** — `POST { subscription, lat, lng, tz, locale, prefs }` → upserts a
  doc in Firestore `prayerSubs`, computing `nextNotifyAt` (Umm al-Qura via `adhan`).
- **unsubscribe** — `POST { endpoint }` → deletes the doc.
- **sendDue** (deployed as `send-due`, entry point `sendDue`) — Cloud Scheduler hits
  it every minute with `?secret=…`; it pushes any subscription whose `nextNotifyAt`
  has passed, then recomputes the next one. 404/410 responses prune dead subs.

## Book With Me (booking backend — `booking.js`)

Calendly-style scheduling. Registered from `booking.js` (imported by `index.js`).
No new npm deps — Google/Resend/Telegram are reached over `fetch`, host sessions
are HMAC-signed with `node:crypto`, the `.ics` is hand-written. See
[`../docs/tools/book-with-me.md`](../docs/tools/book-with-me.md).

- **booking-google-start** (`bookingGoogleStart`) — `GET ?code&locale` → 302 to
  Google consent (offline, calendar scopes).
- **booking-google-callback** (`bookingGoogleCallback`) — exchanges the code,
  upserts `bookingHosts/{googleSub}` with the refresh token, redirects back to the
  dashboard with an HMAC `#hsid` session. **The deployed name must stay
  `booking-google-callback` — it's the OAuth redirect URI in `booking.js`.**
- **save-schedule** (`saveSchedule`) — `POST { hsid, code, tz, meeting, availability, notify, pushSub? }` → upserts the host (hsid-authenticated).
- **get-availability** (`getAvailability`) — `POST { code }` → host meta + open slot epochs (drawn availability − bookings − Google free/busy).
- **book** — `POST { code, startUtc, name, email, note }` → transactional booking (deterministic id `hostUid_startMs` prevents double-booking), creates the Calendar event, fires push + Telegram + Resend email w/ `.ics`.
- **telegram-webhook** (`telegramWebhook`) — Telegram calls it; `/start <code>` links the sender's chat to that host.

### Extra secrets/vars for booking

- `GOOGLE_OAUTH_CLIENT_ID` (repo **variable** — public) / `GOOGLE_OAUTH_CLIENT_SECRET` (secret).
- `RESEND_API_KEY` (secret) — Resend transactional email; sending domain `built-in-saudi.com` must be verified.
- `TELEGRAM_BOT_TOKEN` (secret) — from @BotFather. `SENDER_SECRET` is reused to sign host sessions.

### One-time Telegram webhook

After deploy, point the bot at the webhook once:

```sh
HOOK=$(gcloud functions describe telegram-webhook --gen2 --region=us-central1 --format='value(serviceConfig.uri)')
curl "https://api.telegram.org/bot<token>/setWebhook?url=${HOOK}"
```

## Important: ESM only

`adhan`'s CommonJS build is broken (`Cannot find module './CalculationMethod.js'`),
so this package is **ESM** (`"type": "module"`, `import` syntax). Keep it that way.

## Secrets (never committed)

Set at deploy time via `--set-env-vars`, stored only in the function environment:

- `VAPID_PUBLIC` / `VAPID_PRIVATE` — Web Push VAPID keypair (`npx web-push generate-vapid-keys`).
  The **public** key is also hard-coded in the client (`src/lib/push.ts`) — that's fine, it's public.
- `SENDER_SECRET` — shared secret guarding `sendDue`; Cloud Scheduler passes it as `?secret=`.

## Deploy

**CI deploys these automatically** on any `functions/**` change via
`.github/workflows/deploy-functions.yml` (keyless auth through Workload Identity
Federation). The manual commands below are the fallback / reference.

```sh
ENVV="VAPID_PUBLIC=<pub>,VAPID_PRIVATE=<priv>,SENDER_SECRET=<secret>"
gcloud functions deploy subscribe   --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=. --entry-point=subscribe   --trigger-http --allow-unauthenticated --set-env-vars="$ENVV"
gcloud functions deploy unsubscribe --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=. --entry-point=unsubscribe --trigger-http --allow-unauthenticated --set-env-vars="$ENVV"
gcloud functions deploy send-due    --gen2 --runtime=nodejs20 --region=us-central1 \
  --source=. --entry-point=sendDue     --trigger-http --allow-unauthenticated --set-env-vars="$ENVV"

# every-minute scheduler
SEND_URL=$(gcloud functions describe send-due --gen2 --region=us-central1 --format='value(serviceConfig.uri)')
gcloud scheduler jobs create http prayer-send --location=us-central1 \
  --schedule="* * * * *" --uri="${SEND_URL}?secret=<secret>" --http-method=GET
```
