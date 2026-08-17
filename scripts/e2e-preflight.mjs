// Decide whether the e2e run can reach the third-party hosts the shell loads,
// and if it cannot, tell Playwright to fail them INSTANTLY instead of hanging.
//
// Why this exists: `index.html` pulls Google Fonts, the GA4 tag and the
// privacy-first analytics beacon. `page.goto` waits for the load event, so when
// those hosts are unreachable every single navigation costs ~26 seconds —
// measured here: fonts 12.9s, gtag 12.9s, the beacon 25.7s, all ending in
// ERR_CONNECTION_RESET. A one-navigation test survives the 60s budget and a
// FOUR-navigation test does not, so the suite failed on
//   · tools › image tools: ascii/meme/favicon/steganography render a dropzone
//   · tools › media/privacy tools render their entry points
//   · shell › a stale shell does not put the update check into a reload loop
//   · update gate › with no work open, a new build reloads
// with a timeout mid-`goto` — which reads as a broken tool, and is not one.
//
// This is not only a sandbox problem. The deploy has ALREADY been blocked once
// by the second analytics provider (commit 29e8c03: the site served a build
// predating the tag it was meant to ship, for a day). A suite that gates every
// deploy should not be at the mercy of somebody else's uptime.
//
// It is deliberately a PROBE rather than a flag defaulted on, because blocking
// the hosts costs real fidelity: with GA4 genuinely loading, the cookieless
// case proves our consent config keeps it from writing `_ga`, and with GA4
// blocked that half of it cannot fail. So on a normal machine nothing changes,
// and when it does change it says so loudly — a reduced-fidelity run must never
// look like a full one.

import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'

/** Hosts the built shell fetches. Keep in step with index.html. */
const HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'analytics.google.com',
  'analytics.ali-web-services.com',
]

/**
 * Ask THE BROWSER, not Node.
 *
 * The first version of this probe used Node's `fetch` and reported every host
 * reachable while Playwright's Chromium stalled on all of them — because a
 * sandbox can route Node through an HTTP proxy (HTTPS_PROXY) that the browser
 * does not use. So the probe measured a network the suite does not run on and
 * confidently disabled the fix for the problem it was written to detect. Same
 * lesson this repo has recorded about `relatedcheck` and the search benches:
 * an unfaithful measurement hides a defect as readily as it invents one.
 * Probe in the engine that will actually load the page.
 */
async function unreachableHosts() {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const bad = []
    for (const host of HOSTS) {
      try {
        // Any HTTP answer proves the host is there; a 404 is a fine answer,
        // since this tests the network rather than the URL.
        await page.goto(`https://${host}/`, { timeout: 5000, waitUntil: 'commit' })
      } catch {
        bad.push(host)
      }
    }
    return bad
  } finally {
    await browser.close()
  }
}

const unreachable = await unreachableHosts()

const env = { ...process.env }
if (unreachable.length) {
  env.BIS_OFFLINE = '1'
  console.log('e2e preflight: third-party hosts unreachable, blocking them so the suite does not stall:')
  for (const h of unreachable) console.log(`  · ${h}`)
  console.log('  REDUCED FIDELITY: the cookieless case cannot prove GA4 declines to')
  console.log('  set _ga when the tag never loads. It still asserts the consent')
  console.log('  config in the served HTML, which is the mechanism.\n')
} else {
  console.log('e2e preflight: third-party hosts reachable — full-fidelity run.\n')
}

const child = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 1)))
