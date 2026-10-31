import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RootRedirect } from './components/RootRedirect'
import { HomePage } from './pages/HomePage'
import { ToolPage } from './pages/ToolPage'
import { BookingPage } from './pages/BookingPage'
import { ShortLinkPage } from './pages/ShortLinkPage'
import { CallLinkPage } from './pages/CallLinkPage'
import { CategoryPage } from './pages/CategoryPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorPage } from './components/ErrorPage'

/** Redirect legacy /:lang/tools/:id links to the new /:lang/apps/:id. */
function AppsRedirect() {
  const { lang, toolId } = useParams()
  return <Navigate to={`/${lang}/apps/${toolId}`} replace />
}

/** Renamed tools keep their old /apps/<old-id> URL working with a redirect to
 *  the new id (cv-generator → ats-cv-optimizer). */
function RenamedToolRedirect({ to }: { to: string }) {
  const { lang } = useParams()
  return <Navigate to={`/${lang}/apps/${to}`} replace />
}

/** A category folded into another one: its old address lands on the survivor. */
function CategoryRedirect({ to }: { to: string }) {
  const { lang } = useParams()
  return <Navigate to={`/${lang}/c/${to}/`} replace />
}

/** A tool we removed on purpose. Old links and search results will point at it
 *  for a long time, so send them to the catalogue rather than a dead end. */
function RetiredToolRedirect() {
  const { lang } = useParams()
  return <Navigate to={`/${lang}`} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  // Short links: built-in-saudi.com/s/<code> → resolve + redirect (no locale, no chrome).
  { path: '/s/:code', element: <ShortLinkPage />, errorElement: <ErrorPage /> },
  // Personal "call me" link: built-in-saudi.com/call/?c=<code> (prerendered preview
  // page) → ring the owner + join a fresh room as the caller (no locale, no chrome).
  // /call/<code> path kept for older links.
  { path: '/call', element: <CallLinkPage />, errorElement: <ErrorPage /> },
  { path: '/call/:code', element: <CallLinkPage />, errorElement: <ErrorPage /> },
  {
    // Locale-prefixed section. Layout validates :lang and redirects if invalid.
    path: '/:lang',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage />, errorElement: <ErrorPage /> },
      // Renamed tool: /apps/cv-generator → /apps/ats-cv-optimizer (static, so it
      // outranks the :toolId route below).
      { path: 'apps/cv-generator', element: <RenamedToolRedirect to="ats-cv-optimizer" /> },
      // MERGED, not withdrawn: `image-rearrange` cut pieces out of a picture
      // and laid other pictures on it, and `image-edit` does both — the
      // scissors and the plus — in one session with the crop, the boxes and the
      // captions. So its links go to the tool that took the job over rather
      // than to the catalogue: a merge is a rename of where the capability
      // lives. September 2026.
      { path: 'apps/image-rearrange', element: <RenamedToolRedirect to="image-edit" /> },
      // Both retirements below are the same rule: every app here must be halal,
      // so a tool whose SUBJECT is impermissible does not belong in the
      // catalogue at all. See docs/ROADMAP.md "Out of scope" — and note these
      // lines are what scripts/check-retired.mjs reads, so deleting one lets
      // the id silently come back.
      { path: 'apps/loan-calculator', element: <RetiredToolRedirect /> },
      // A chromatic tuner has no use except playing an instrument, which is a
      // contested question the catalogue abstains from rather than takes a side
      // on. Withdrawn August 2026.
      { path: 'apps/tuner', element: <RetiredToolRedirect /> },
      { path: 'apps/pomodoro', element: <RenamedToolRedirect to="stopwatch" /> },
      { path: 'apps/age-calculator', element: <RenamedToolRedirect to="date-diff" /> },
      { path: 'apps/working-days', element: <RenamedToolRedirect to="date-diff" /> },
      { path: 'apps/pdf-organise', element: <RenamedToolRedirect to="pdf-merge" /> },
      { path: 'apps/images-to-pdf', element: <RenamedToolRedirect to="pdf-merge" /> },
      // November 2026: the catalogue was cut from 244 tools to about 100. A
      // MERGED tool redirects to the one that now does its job; a WITHDRAWN one
      // (it encoded a regulation, was a health calculator, or nobody used it)
      // redirects to the catalogue. scripts/check-retired.mjs reads these lines.
      { path: 'apps/video-gif', element: <RenamedToolRedirect to="video-edit" /> },
      { path: 'apps/video-frames', element: <RenamedToolRedirect to="video-edit" /> },
      { path: 'apps/video-stabilize', element: <RenamedToolRedirect to="video-edit" /> },
      // November 2026: the catalogue was cut from 244 tools to about 100. A
      // MERGED tool redirects to the one that now does its job; a WITHDRAWN one
      // (it encoded a regulation, was a health calculator, or nobody used it)
      // redirects to the catalogue. scripts/check-retired.mjs reads these lines.
      { path: 'apps/docx-to-text', element: <RenamedToolRedirect to="word-editor" /> },
      { path: 'apps/docx-markdown', element: <RenamedToolRedirect to="word-editor" /> },
      { path: 'apps/markdown-docx', element: <RenamedToolRedirect to="word-editor" /> },
      { path: 'apps/markdown-html', element: <RenamedToolRedirect to="word-editor" /> },
      { path: 'apps/paste-to-markdown', element: <RenamedToolRedirect to="word-editor" /> },
      { path: 'apps/csv-to-xlsx', element: <RenamedToolRedirect to="excel-editor" /> },
      { path: 'apps/xlsx-convert', element: <RenamedToolRedirect to="excel-editor" /> },
      { path: 'apps/pptx-to-text', element: <RenamedToolRedirect to="powerpoint-editor" /> },
      { path: 'apps/video-trim', element: <RenamedToolRedirect to="video-edit" /> },
      { path: 'apps/image-cropper', element: <RenamedToolRedirect to="image-edit" /> },
      { path: 'apps/image-redact', element: <RenamedToolRedirect to="image-edit" /> },
      { path: 'apps/meme-generator', element: <RenamedToolRedirect to="image-edit" /> },
      { path: 'apps/image-format-converter', element: <RenamedToolRedirect to="image-compressor" /> },
      { path: 'apps/pdf-to-text', element: <RenamedToolRedirect to="pdf-ocr" /> },
      { path: 'apps/cron-explainer', element: <RenamedToolRedirect to="cron-builder" /> },
      { path: 'apps/random-picker', element: <RenamedToolRedirect to="spin-wheel" /> },
      { path: 'apps/countdown', element: <RenamedToolRedirect to="stopwatch" /> },
      { path: 'apps/prayer-timetable', element: <RenamedToolRedirect to="prayer-times" /> },
      { path: 'apps/gosi-salary', element: <RetiredToolRedirect /> },
      { path: 'apps/iqama-fees', element: <RetiredToolRedirect /> },
      { path: 'apps/traffic-fine', element: <RetiredToolRedirect /> },
      { path: 'apps/exit-reentry', element: <RetiredToolRedirect /> },
      { path: 'apps/saudi-holidays', element: <RetiredToolRedirect /> },
      { path: 'apps/end-of-service', element: <RetiredToolRedirect /> },
      { path: 'apps/sponsorship-transfer', element: <RetiredToolRedirect /> },
      { path: 'apps/retirement-age', element: <RetiredToolRedirect /> },
      { path: 'apps/leave-overtime', element: <RetiredToolRedirect /> },
      { path: 'apps/zatca-qr', element: <RetiredToolRedirect /> },
      { path: 'apps/pricing', element: <RetiredToolRedirect /> },
      { path: 'apps/admission-score', element: <RetiredToolRedirect /> },
      { path: 'apps/early-settlement', element: <RetiredToolRedirect /> },
      { path: 'apps/cr-renewal', element: <RetiredToolRedirect /> },
      { path: 'apps/electricity-bill', element: <RetiredToolRedirect /> },
      { path: 'apps/import-duty', element: <RetiredToolRedirect /> },
      { path: 'apps/fuel-cost', element: <RetiredToolRedirect /> },
      { path: 'apps/domestic-worker', element: <RetiredToolRedirect /> },
      { path: 'apps/rent-rules', element: <RetiredToolRedirect /> },
      { path: 'apps/vehicle-renewal', element: <RetiredToolRedirect /> },
      { path: 'apps/gpa-calculator', element: <RetiredToolRedirect /> },
      { path: 'apps/zatca-wave', element: <RetiredToolRedirect /> },
      { path: 'apps/vat-calculator', element: <RetiredToolRedirect /> },
      { path: 'apps/vat-registration', element: <RetiredToolRedirect /> },
      { path: 'apps/timesheet', element: <RetiredToolRedirect /> },
      { path: 'apps/rett', element: <RetiredToolRedirect /> },
      { path: 'apps/ac-size', element: <RetiredToolRedirect /> },
      { path: 'apps/invoice-generator', element: <RetiredToolRedirect /> },
      { path: 'apps/quotation', element: <RetiredToolRedirect /> },
      { path: 'apps/due-date', element: <RetiredToolRedirect /> },
      { path: 'apps/ovulation', element: <RetiredToolRedirect /> },
      { path: 'apps/calorie-needs', element: <RetiredToolRedirect /> },
      { path: 'apps/water-intake', element: <RetiredToolRedirect /> },
      { path: 'apps/medicine-schedule', element: <RetiredToolRedirect /> },
      { path: 'apps/glucose-units', element: <RetiredToolRedirect /> },
      { path: 'apps/sleep-cycle', element: <RetiredToolRedirect /> },
      { path: 'apps/base64', element: <RetiredToolRedirect /> },
      { path: 'apps/csv-clean', element: <RetiredToolRedirect /> },
      { path: 'apps/email-headers', element: <RetiredToolRedirect /> },
      { path: 'apps/regex-tester', element: <RetiredToolRedirect /> },
      { path: 'apps/svg-editor', element: <RetiredToolRedirect /> },
      { path: 'apps/csv-merge', element: <RetiredToolRedirect /> },
      { path: 'apps/curl-convert', element: <RetiredToolRedirect /> },
      { path: 'apps/gitignore', element: <RetiredToolRedirect /> },
      { path: 'apps/hmac', element: <RetiredToolRedirect /> },
      { path: 'apps/unix-timestamp', element: <RetiredToolRedirect /> },
      { path: 'apps/ip-subnet', element: <RetiredToolRedirect /> },
      { path: 'apps/json-to-types', element: <RetiredToolRedirect /> },
      { path: 'apps/token-counter', element: <RetiredToolRedirect /> },
      { path: 'apps/a11y-check', element: <RetiredToolRedirect /> },
      { path: 'apps/link-preview', element: <RetiredToolRedirect /> },
      { path: 'apps/meta-tags', element: <RetiredToolRedirect /> },
      { path: 'apps/robots-txt', element: <RetiredToolRedirect /> },
      { path: 'apps/user-agent', element: <RetiredToolRedirect /> },
      { path: 'apps/color-contrast', element: <RetiredToolRedirect /> },
      { path: 'apps/color-palette', element: <RetiredToolRedirect /> },
      { path: 'apps/color-tools', element: <RetiredToolRedirect /> },
      { path: 'apps/gradient-generator', element: <RetiredToolRedirect /> },
      { path: 'apps/svg-optimise', element: <RetiredToolRedirect /> },
      { path: 'apps/aspect-ratio', element: <RetiredToolRedirect /> },
      { path: 'apps/box-shadow', element: <RetiredToolRedirect /> },
      { path: 'apps/audio-trim', element: <RetiredToolRedirect /> },
      { path: 'apps/hex-viewer', element: <RetiredToolRedirect /> },
      { path: 'apps/file-metadata', element: <RetiredToolRedirect /> },
      { path: 'apps/csv-split', element: <RetiredToolRedirect /> },
      { path: 'apps/file-encrypt', element: <RetiredToolRedirect /> },
      { path: 'apps/archive-inspector', element: <RetiredToolRedirect /> },
      { path: 'apps/remove-silence', element: <RetiredToolRedirect /> },
      { path: 'apps/sheet-diff', element: <RetiredToolRedirect /> },
      { path: 'apps/video-audio', element: <RetiredToolRedirect /> },
      { path: 'apps/zip-create', element: <RetiredToolRedirect /> },
      { path: 'apps/image-base64', element: <RetiredToolRedirect /> },
      { path: 'apps/carousel-split', element: <RetiredToolRedirect /> },
      { path: 'apps/favicon-generator', element: <RetiredToolRedirect /> },
      { path: 'apps/image-diff', element: <RetiredToolRedirect /> },
      { path: 'apps/metadata-remove', element: <RetiredToolRedirect /> },
      { path: 'apps/screen-recorder', element: <RetiredToolRedirect /> },
      { path: 'apps/screenshot-frame', element: <RetiredToolRedirect /> },
      { path: 'apps/social-resize', element: <RetiredToolRedirect /> },
      { path: 'apps/print-size', element: <RetiredToolRedirect /> },
      { path: 'apps/pdf-redact', element: <RetiredToolRedirect /> },
      { path: 'apps/pdf-stamp', element: <RetiredToolRedirect /> },
      { path: 'apps/pdf-booklet', element: <RetiredToolRedirect /> },
      { path: 'apps/pdf-diff', element: <RetiredToolRedirect /> },
      { path: 'apps/pdf-split', element: <RetiredToolRedirect /> },
      { path: 'apps/epub-text', element: <RetiredToolRedirect /> },
      { path: 'apps/markdown-epub', element: <RetiredToolRedirect /> },
      { path: 'apps/vcard-to-csv', element: <RetiredToolRedirect /> },
      { path: 'apps/bingo-cards', element: <RetiredToolRedirect /> },
      { path: 'apps/ics-builder', element: <RetiredToolRedirect /> },
      { path: 'apps/totp', element: <RetiredToolRedirect /> },
      { path: 'apps/hash-generator', element: <RetiredToolRedirect /> },
      { path: 'apps/paper-generator', element: <RetiredToolRedirect /> },
      { path: 'apps/word-search', element: <RetiredToolRedirect /> },
      { path: 'apps/label-sheet', element: <RetiredToolRedirect /> },
      { path: 'apps/data-anonymize', element: <RetiredToolRedirect /> },
      { path: 'apps/fix-encoding', element: <RetiredToolRedirect /> },
      { path: 'apps/speech-time', element: <RetiredToolRedirect /> },
      { path: 'apps/summarize', element: <RetiredToolRedirect /> },
      { path: 'apps/lorem-ipsum', element: <RetiredToolRedirect /> },
      { path: 'apps/invisible-chars', element: <RetiredToolRedirect /> },
      { path: 'apps/line-breaks', element: <RetiredToolRedirect /> },
      { path: 'apps/list-tools', element: <RetiredToolRedirect /> },
      { path: 'apps/readability', element: <RetiredToolRedirect /> },
      { path: 'apps/slugify', element: <RetiredToolRedirect /> },
      { path: 'apps/sun-times', element: <RetiredToolRedirect /> },
      { path: 'apps/timezone-planner', element: <RetiredToolRedirect /> },
      { path: 'apps/sound-meter', element: <RetiredToolRedirect /> },
      { path: 'apps/json-formatter', element: <RetiredToolRedirect /> },
      { path: 'apps/text-counter', element: <RetiredToolRedirect /> },
      { path: 'apps/text-diff', element: <RetiredToolRedirect /> },
      { path: 'apps/percentage-calculator', element: <RetiredToolRedirect /> },
      // Before apps/:toolId in the file, though React Router ranks a static
      // segment above a dynamic one regardless of order.
      // Categories folded into others in the November 2026 cut. Old links land
      // where their tools went, or on the catalogue when they scattered.
      { path: 'c/web', element: <CategoryRedirect to="developer" /> },
      { path: 'c/time', element: <CategoryRedirect to="calculators" /> },
      { path: 'c/design', element: <RetiredToolRedirect /> },
      { path: 'c/converters', element: <RetiredToolRedirect /> },
      { path: 'c/health', element: <RetiredToolRedirect /> },
      { path: 'c/compare', element: <RetiredToolRedirect /> },
      { path: 'c/new-business', element: <RetiredToolRedirect /> },
      { path: 'c/:slug', element: <CategoryPage />, errorElement: <ErrorPage /> },
      { path: 'apps/:toolId', element: <ToolPage />, errorElement: <ErrorPage /> },
      // In-call / invite URL for the Calls app: /apps/calls/join?code=… renders the
      // same tool (it reads the code from the query).
      { path: 'apps/:toolId/join', element: <ToolPage />, errorElement: <ErrorPage /> },
      { path: 'tools/:toolId', element: <AppsRedirect /> },
      // Public booking page. Shared as built-in-saudi.com/book/<code> — a bare
      // /book/<code> hits Layout with an invalid :lang and redirects to the
      // visitor's locale (/en|/ar), so booking links aren't language-locked.
      { path: 'book/:code', element: <BookingPage />, errorElement: <ErrorPage /> },
      { path: 'privacy', element: <PrivacyPage />, errorElement: <ErrorPage /> },
      { path: 'terms', element: <TermsPage />, errorElement: <ErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
