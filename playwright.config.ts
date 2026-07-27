import { defineConfig, devices } from '@playwright/test'

// E2E against the built site. `BASE_URL` skips the local webServer (used when a
// server is already running, e.g. in Docker). Otherwise Playwright serves the
// production build via `vite preview`.
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  // Playwright's default 30s per-test budget is too small for the multi-context
  // WebRTC specs: they stand up two or three browsers, form real peer connections
  // and wait on a polling relay, and their own declared waits already total more
  // than 30s. Blowing that budget was showing up as "flakiness" when it was really
  // the harness cutting a legitimately slow test short. A hung test still fails,
  // just with an honest budget — this is NOT a retry.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries, anywhere. A retry turns a flaky test green and lets the flake ship;
  // the suite gates every deploy, so it has to be trustworthy on the first run. A
  // failure here is a real defect — in the product or in the test — and gets fixed,
  // not re-rolled.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    // With no retries there is no "first retry" to trace, so keep the trace of any
    // failure instead — that's what makes a red CI run diagnosable.
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
