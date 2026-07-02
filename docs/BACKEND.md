# Backend: the flat-rate FIFO "job worker" (and beyond)

> Status: **exploration**. Nothing here is built yet. This weighs a cheap,
> always-on backend against our client-first, privacy-first brand.

## The idea

One small, always-on server running a **first-in-first-out job queue**. Clients
submit a job (`split this PDF`, `convert these images`, `remove this
background`), get a job id, poll for status, then download the result. A single
worker drains the queue serially (or with tiny concurrency). Flat monthly cost,
predictable, no per-request billing surprises.

It also doubles as a home for **lightweight synchronous endpoints** that aren't
"jobs" at all — e.g. a **"book a meeting with me"** calendar service.

## The brand tension (read this first)

Our entire pitch is **"nothing is uploaded — it runs in your browser."** A
backend *breaks that promise* for whatever tool uses it. That's not fatal, but it
must be **explicit and principled**:

- Clearly badge server-processed tools ("Processed on our server, then deleted")
  vs the client-side ones ("Never leaves your device").
- **Delete inputs and outputs within minutes**; never log file contents; HTTPS only.
- Prefer client-side whenever technically possible; only reach for the queue when
  the browser genuinely can't do it well (PDF↔Office, OCR, ML background removal,
  very large batches).
- Consider a visible, honest line: *"Most of our tools run 100% on your device.
  A few (marked ⚙︎) need our server — here's exactly what we do with your file."*

If we keep that discipline, the backend *complements* the brand instead of
diluting it.

## Flat-rate economics

| Option | ~Cost/mo | Model | Fit |
|--------|----------|-------|-----|
| Small VPS (Hetzner CX22 / DO / GCP e2-small) | **$5–7** | flat, always-on | ✅ best for "flat rate + FIFO worker" |
| GCP Cloud Run | pay-per-use, ~$0 idle | scales to zero | good for the *booking* API, less so for steady heavy jobs |
| GCP e2-micro | free-tier-ish | flat | ok for the booking API / tiny jobs |

Recommendation: **one small VPS** (~$5–7/mo) running (a) an API + (b) a queue
worker. Redis + a worker lib (BullMQ) is the textbook stack, but for a single box
a SQLite-backed queue or even an in-process queue is enough to start. Put
Cloudflare in front (free) for TLS, caching, and basic DDoS/rate-limiting.

## Queue design principles
- **FIFO**, single worker (predictable, cheap); show queue position to the user.
- Job lifecycle: `queued → processing → done|failed`; poll by id (or SSE).
- **Ephemeral storage**: results live behind an unguessable URL, auto-deleted
  after N minutes; inputs deleted immediately after processing.
- **Guards**: max file size, per-IP rate limit, max queue depth (shed load
  gracefully with "busy, try again"), allowed job types only.
- **Stateless-ish**: the box can die and restart; don't promise durability of
  in-flight jobs (or persist the queue in SQLite if we want resilience).

## Candidate workloads — confidence scores

Score = **usability (demand × how much better than client-side)** vs
**infra cost/effort**. Confidence is my gut call on "worth building on the flat-rate box."

| Workload | Usability | Infra cost | Confidence | Notes |
|----------|-----------|-----------|-----------|-------|
| **Book-a-meeting (calendar)** | High | Very low (tiny, sync) | **85%** | Not a "job"; low compute; big personal-brand value. Best first backend thing. |
| PDF ↔ Word/Excel | High | Medium (LibreOffice headless is heavy but flat) | **70%** | Real gap client-side can't fill; the classic adware bait. Watch RAM on a small box. |
| OCR (image/PDF → text) | Med-High | Medium (Tesseract) | **60%** | Also possible client-side via `tesseract.js`; server is faster/cleaner for big files. |
| Background removal | High | Medium-High (ML model / rembg) | **55%** | Client-side WASM (`@imgly`) may be good enough — try that *before* paying server cost. |
| Website / HTML → PDF (headless Chrome) | Medium | High (Chromium RAM) | **45%** | Fun and demanded, but Chromium on a $5 box is a memory hog; throttle hard. |
| Video trim/convert (ffmpeg) | Medium | High (CPU) | **35%** | `ffmpeg.wasm` exists client-side; server ffmpeg will saturate one core fast. |
| Batch conversions (100s of files) | Medium | Medium | **55%** | The queue shines here; but cap batch size to protect the worker. |

**Rule of thumb:** if `ffmpeg.wasm` / `pdf-lib` / `@imgly` can do it acceptably
in the browser, **keep it client-side** (free, private, infinitely scalable). Use
the box only for what the browser genuinely can't.

## The booking service ("book a meeting with me")

- **Why it's the best first backend feature:** trivial compute, always-on but
  cheap, no big privacy tension (it's *your* calendar, not user files), and it's
  a real, personal, monetisable service.
- **Shape:** a `/book` page shows available slots pulled from a calendar; user
  picks one and submits name/email; the server creates the event and emails
  confirmations. Google Calendar API fits (the account is already in the GCP
  project `blitz-ksa`). Alternatively integrate Cal.com's API and just skin it.
- **Watch-outs:** spam (add a light captcha/honeypot + rate limit), timezone
  correctness (default Asia/Riyadh), double-booking (check freebusy before create),
  and email deliverability.
- **Confidence: 85%** — high usability, very low infra cost. Strong candidate to
  build first, independent of the heavy job-queue.

## Wild brainstorm (mind kept open)

Scored the same way (usability vs infra cost → confidence):

- **Dynamic QR codes** (redirect + scan analytics) — pairs with our live QR tool;
  needs storage + a redirect endpoint. Usability High, cost Low → **80%**. *Very
  synergistic with what we already shipped.*
- **Form backend** ("contact form as a service", submissions → email/webhook) —
  Usability Med, cost Very low → **70%**.
- **Short links / URL shortener** (branded `bis.sa`-style) — Usability Med, cost
  Low, but abuse/moderation burden → **55%**.
- **Request bin / webhook tester** (devs inspect incoming requests) — Usability
  Med (dev niche), cost Low → **60%**.
- **OG image generator API** (pretty social cards from params) — Usability Med,
  cost Low-Med (needs rendering) → **55%**.
- **Ephemeral file share** (WeTransfer-lite, auto-expire) — Usability High, cost
  **High** (bandwidth/storage is the whole product) → **40%**. Bandwidth eats the
  flat rate; risky.
- **Disposable/temp email inbox** — Usability High, cost Med, but heavy
  abuse/deliverability/legal surface → **35%**.
- **Uptime pinger / status page** (cron checks a URL, alerts) — Usability Med,
  cost Very low → **60%**.
- **Scheduled "email me this"** (reminders/digests via cron) — Usability Med, cost
  Low → **55%**.

## Recommended phasing

1. **Ship more client-side tools first** (the whole Tier-1 list is free to run and
   on-brand). Prove traffic before paying for a server.
2. **Stand up the $5–7 VPS for the booking service** — highest confidence (85%),
   lowest risk, and it's independent of the queue.
3. **Add the FIFO job worker** once there's demand, starting with **PDF↔Office**
   (70%) — the clearest thing the browser can't do — behind an explicit
   "server-processed, deleted after" badge.
4. **Layer dynamic-QR analytics** (80%) as a natural upsell of our flagship QR tool.
5. Everything bandwidth-heavy (file share, video) stays parked until the economics
   are justified by real usage.

**Bottom line:** the flat-rate box is worth it, but sequence it — booking + dynamic
QR are the high-confidence, low-cost wins; the heavy converters are worth it only
where the browser can't compete, and only with strict privacy hygiene.

## Deferred — needs a backend (parked TODOs)
These were requested but require infra, so they wait until we stand up the backend:
- **Prayer-time alerts** (#6) and **"alert me N days before" for Islamic dates** (#8):
  background/phone notifications when the site is closed need **Web Push (VAPID)**
  — a small push backend. Local/while-open notifications remain possible client-side.
