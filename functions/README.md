# Prayer alert backend (Cloud Functions gen2)

Web Push backend for prayer-time notifications. Three HTTP functions on GCP
project `blitz-ksa`, region `us-central1`, plus Firestore + Cloud Scheduler.

- **subscribe** — `POST { subscription, lat, lng, tz, locale, prefs }` → upserts a
  doc in Firestore `prayerSubs`, computing `nextNotifyAt` (Umm al-Qura via `adhan`).
- **unsubscribe** — `POST { endpoint }` → deletes the doc.
- **sendDue** (deployed as `send-due`, entry point `sendDue`) — Cloud Scheduler hits
  it every minute with `?secret=…`; it pushes any subscription whose `nextNotifyAt`
  has passed, then recomputes the next one. 404/410 responses prune dead subs.

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
