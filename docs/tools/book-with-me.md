# Book With Me (Calendly-style scheduler)

- **Slug:** `/tools/book-with-me` (host dashboard) · **Public booking:** `built-in-saudi.com/book/<code>`
  (path-based; the `book-a-meeting` subdomain is deferred, so no Cloudflare)
- **Category:** Business · **Priority:** Tier 1 (flagship)
- **Runs:** hybrid — host UI is client-side; booking/notifications need the backend (badge ⚙︎)
- **Status:** In progress
- **Locale wedge:** bilingual booking pages (AR/EN), Asia/Riyadh-first timezone handling

## Why

Calendly's core loop — *set your availability once, share one link, let people
self-book without the email ping-pong* — is genuinely useful and universally
buried behind sign-ups and upsells. We give it away: a clean weekly
availability painter, a shareable link, real Google Calendar conflict-checking,
and instant push/Telegram/email on every booking. It's our first tool where the
**host** logs in (bookers never do — they just pick a slot), so it establishes
our auth + subdomain + transactional-email patterns for everything after it.

## The two apps

1. **Host dashboard** — `src/tools/book-with-me/BookWithMeTool.tsx`, lives in the
   catalog like any tool. Google Sign-In, the **drag-to-paint weekly availability
   grid**, meeting config (length / gap / buffer / horizon), Google Calendar
   connect, notification setup (Web Push subscribe + Telegram link), and the
   shareable link. Host state persists to Firestore via `saveSchedule`.
2. **Public booking page** — `src/pages/BookingPage.tsx` at
   `/:lang/book/:code`, shared as `built-in-saudi.com/book/<code>` (a bare
   `/book/<code>` redirects to the visitor's locale via Layout, so links aren't
   language-locked). No login. Shows real open slots = **drawn availability −
   Google free/busy − existing bookings**; collects booker name + email + note;
   books. The `book-a-meeting` subdomain is deferred — path-based needs no extra
   host, so Cloudflare is skipped for now.

## Architecture — reuses the prayer-alerts backend wholesale

**Net-new GCP services: zero.** Everything sits on infra we already run:

| Need | Service | Status |
|---|---|---|
| Store hosts, availability, bookings | **Firestore** | ✅ provisioned — add `bookingHosts` + `bookings` |
| API endpoints | **Cloud Functions gen2** (`blitz-ksa`/`us-central1`, nodejs20, ESM) | ✅ WIF deploy pipeline exists |
| Device alert on booking | **Web Push (VAPID)** | ✅ reuse `src/lib/push.ts` + existing keys |
| Optional "meeting in 1h" reminders | **Cloud Scheduler** | ✅ exists — deferred, not in v1 |

New endpoints (each an `http('name', …)` in `functions/index.js`, matching the
existing one-function-per-endpoint + CORS-preamble convention):

- `googleAuthStart` / `googleAuthCallback` — host OAuth (offline, stores refresh token).
- `saveSchedule` — upsert host availability + meeting config + notify prefs (auth: verified Google ID token).
- `getAvailability` — public; returns open slots for a `<code>` over the booking horizon.
- `book` — public; re-validates the slot, writes the booking, creates the Google Calendar event, fires all notifications.
- `linkTelegram` — associates a Telegram chat id with a host (via bot deep-link `/start <code>`).
- Push reuses the existing `subscribe`/`unsubscribe`; booking prefs are additive fields on the subscription doc (same merge pattern as prayer/adhkar).

### Data model (Firestore)

`bookingHosts/{uid}` — one per signed-in Google host:
```
{
  code,                    // short public slug → the shareable link (indexed/unique)
  email, name, picture,    // from Google profile
  tz,                      // IANA, default 'Asia/Riyadh'
  meeting: { minutes: 45, gapMinutes: 0, bufferBefore: 0, bufferAfter: 0,
             horizonDays: 30, minNoticeHours: 4, title, location },
  availability: [ { day: 0..6, start: '09:00', end: '17:00' }, ... ],  // weekly, host-tz local
  google: { refreshToken, calendarId: 'primary', connectedAt } | null,
  notify: { push: bool, telegram: bool, email: bool, telegramChatId },
  createdAt, updatedAt,
}
```

`bookings/{id}`:
```
{
  hostUid, code,
  startUtc, endUtc,        // Timestamps
  booker: { name, email, note },
  gcalEventId | null,
  status: 'confirmed' | 'cancelled',
  createdAt,
}
```

### Booking flow (one `book()` invocation)

1. Validate the slot is still inside availability, not in the past, respects
   `minNoticeHours`, and doesn't collide with an existing `bookings` doc.
2. Re-check Google **free/busy** for the host (guards against events booked
   elsewhere since the page loaded).
3. Write the `bookings` doc (transaction, so two people can't grab the same slot).
4. Create the **Google Calendar event** on the host's calendar with the booker as
   an attendee (Google sends its own invite too).
5. Fire notifications: **Web Push** + **Telegram sendMessage** to the host, and a
   **Resend** confirmation email to the booker (and host) with a generated `.ics`.

## Notifications — cost

- **Device push** — free, reuses VAPID. Host subscribes from the dashboard.
- **Telegram DM** — **free** via Bot API. One BotFather bot; host links their chat
  with the deep-link `t.me/<bot>?start=<code>`; `book()` calls `sendMessage`.
- **Email — needed**, for the booker confirmation + a real calendar entry.
  Cheapest reliable path is **Resend** (free tier 100/day, 3k/mo — ample for a
  personal booking tool), sending an HTML confirmation with a server-generated
  **`.ics`** attachment so both parties get a calendar event even without the
  Google integration. SES is cheaper at scale but needs more setup and isn't free
  off-EC2 — not worth it at this volume.

## Google Calendar OAuth — verification note

Reading free/busy + creating events needs the `calendar.events` +
`calendar.freebusy` scopes, which are **sensitive** and put the OAuth consent
screen into Google's verification review (one-time, a few days). So the tool is
built in two layers that ship independently:

- **Layer 1 (no verification):** host paints availability; conflicts are computed
  against our own `bookings` only. Fully functional the day we deploy.
- **Layer 2 (after verification clears):** connect Google → real free/busy +
  auto-created events. Additive; the host just gains a "Connect Google Calendar"
  button. We are never blocked waiting on Google.

## Requirements (v1)

- [ ] Host: Google Sign-In (GIS one-tap / button; verify ID token server-side).
- [ ] Host: drag-to-paint weekly availability grid (7 day-columns × time rows),
      paint + erase, keyboard/pointer, `prefers-reduced-motion` safe.
- [ ] Host: meeting config — length (45 default), gap, buffer, horizon, min-notice.
- [ ] Host: shareable link + copy; QR of the link (reuse qr logic later).
- [ ] Host: notification setup — push subscribe, Telegram link, email toggle.
- [ ] Booking page: fetch availability by `<code>`, render open slots grouped by
      day in the booker's timezone, pick → enter name/email/note → confirm.
- [ ] `book()` transaction prevents double-booking; sends push + Telegram + email.
- [ ] Layer 2: Google connect → free/busy filtering + event creation.

## Acceptance criteria

- Painting Mon 09:00–12:00 with 45-min meetings + 0 gap yields slots 09:00,
  09:45, 10:45(+buffer)… correctly, in the booker's tz.
- Two simultaneous `book()` calls for the same slot: exactly one succeeds.
- On booking, host gets a push + Telegram DM; booker gets an email with a
  working `.ics`.

## Out of scope (v1)

- Multiple meeting types per host, team/round-robin, payments, reschedule/cancel
  self-service links (park in a follow-up), SMS, recurring meetings.

## External setup checklist (owner actions)

These need accounts/click-ops the code can't do:

1. **Google OAuth** — in `blitz-ksa` create an OAuth 2.0 Client ID (Web).
   Authorized origins: `https://built-in-saudi.com`,
   `https://book-a-meeting.built-in-saudi.com`. Redirect URI: the
   `googleAuthCallback` function URL. Add `calendar.events` + `calendar.freebusy`
   scopes and submit the consent screen for verification. Client ID → repo var,
   client secret → repo secret.
2. ~~**Cloudflare Pages**~~ — **deferred.** Booking is path-based
   (`built-in-saudi.com/book/<code>`) on the existing GitHub Pages host, so no new
   host/DNS is needed. If we later want the `book-a-meeting` subdomain, stand up a
   Cloudflare Pages project on this repo with a wildcard CNAME (see CLAUDE.md).
3. **Resend** — sign up, verify `built-in-saudi.com` as a sending domain (DKIM/SPF
   TXT in Cloud DNS). API key → repo secret `RESEND_API_KEY`.
4. **Telegram** — create a bot via @BotFather; bot token → repo secret
   `TELEGRAM_BOT_TOKEN`; bot username → client config.
5. **GCP secrets** on the functions deploy (same mechanism as `VAPID_*`):
   `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `RESEND_API_KEY`,
   `TELEGRAM_BOT_TOKEN`. Reuse existing `VAPID_*` + `SENDER_SECRET`.
