# Built in Saudi

A growing toolbox of **free, privacy-first online utilities** — the everyday
tools that are usually buried in ads and paywalls elsewhere. Everything runs
client-side: no ads, no sign-ups, nothing uploaded. Branded and proudly built
in Saudi Arabia.

Live at **[built-in-saudi.com](https://built-in-saudi.com)**.

## Stack

- **React + TypeScript**, built with **Vite**
- **React Router** for routing
- No backend — every tool runs entirely in the browser
- Deployed to **GitHub Pages** via GitHub Actions

## Tools

| Tool | Status |
|------|--------|
| QR Code Generator | ✅ Live |
| Password Generator, Image Compressor, Color tools, Unit Converter, JSON Formatter, UUID, Text Counter, Base64 … | 🛠️ On the roadmap |

## Architecture: adding a tool

Tools are self-contained, lazily-loaded modules registered in one place — the
shell (routing, home catalog, tool page, SEO) picks them up automatically.

1. Create `src/tools/<id>/`:
   - `Xyz​Tool.tsx` — the tool UI (default export).
   - `meta.ts` — a `Tool` object (`src/tools/types.ts`) with a lazy `component`.
2. Register it in `src/tools/index.ts`.

That's it. External/showcase tools are supported too — omit `component` and set
`href` to link out instead of routing in.

## Develop

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/ (+ SPA 404 fallback)
npm run preview    # preview the production build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to GitHub Pages.

- Custom domain `built-in-saudi.com` (apex) with `www` → apex, HTTPS enforced.
- DNS is managed in Google Cloud DNS (project `blitz-ksa`).
- `public/CNAME`, `robots.txt`, `sitemap.xml` ship with every build.
- A **prerender plugin** in `vite.config.ts` writes localized static HTML per
  route (`/en`, `/ar`, and each live tool) with correct `<head>`
  (title/description/canonical/hreflang/og) and crawlable content, plus a
  `404.html` SPA fallback. `createRoot` replaces the static block on mount.
