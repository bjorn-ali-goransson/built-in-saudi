import { test, expect } from '@playwright/test'
import { readNumber } from './helpers'

// The spectrum analyser. `lib/audio.ts` already decoded anything the browser
// can play and three tools used it without any of them ever looking at the
// FREQUENCY content — `AnalyserNode` only works on live playback, so there was
// no way to ask about a file without playing it through in real time.
//
// The FFT is testable in the way that matters: feed it a tone at a known
// frequency and the reported cutoff must land on it.

/** A mono 16-bit WAV, built here so a case can state exactly what is in it. */
function wav(sampleRate: number, seconds: number, fill: (i: number, sr: number) => number): Buffer {
  const n = Math.floor(sampleRate * seconds)
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, fill(i, sampleRate)))
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22); head.writeUInt32LE(sampleRate, 24)
  head.writeUInt32LE(sampleRate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

const sine = (hz: number) => (i: number, sr: number) => 0.7 * Math.sin((2 * Math.PI * hz * i) / sr)

async function analyse(page: import('@playwright/test').Page, buf: Buffer, locale = 'en') {
  await page.goto(`/${locale}/apps/audio-spectrum`)
  await page.getByTestId('as-file').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: buf })
  await expect(page.getByTestId('as-cutoff')).toBeVisible({ timeout: 30_000 })
}

test('a 5 kHz tone is reported as stopping at 5 kHz', async ({ page }) => {
  // The decisive test of the FFT: the answer is knowable in advance.
  await analyse(page, wav(44100, 2, sine(5000)))
  const khz = await readNumber(page, 'as-cutoff')
  expect(khz).toBeGreaterThan(4.7)
  expect(khz).toBeLessThan(5.3)
})

test('and a 15 kHz tone at 15, so it is measuring rather than guessing', async ({ page }) => {
  // Without a second frequency the first would pass against anything that
  // happened to print 5.
  await analyse(page, wav(44100, 2, sine(15000)))
  const khz = await readNumber(page, 'as-cutoff')
  expect(khz).toBeGreaterThan(14.5)
  expect(khz).toBeLessThan(15.5)
})

test('a low cutoff is called the signature of a low-bitrate encode', async ({ page }) => {
  await analyse(page, wav(44100, 2, sine(5000)))
  await expect(page.getByTestId('as-verdict')).toContainText('below 17 kHz')
})

test('content running to the top is called consistent with lossless', async ({ page }) => {
  // White noise fills the spectrum to the Nyquist limit, which is what an
  // untouched recording looks like.
  await analyse(page, wav(44100, 2, () => (Math.random() * 2 - 1) * 0.5))
  const khz = await readNumber(page, 'as-cutoff')
  expect(khz).toBeGreaterThan(19)
  await expect(page.getByTestId('as-verdict')).toContainText('lossless')
})

test('the inference is not passed off as the measurement', async ({ page }) => {
  // A recording with no high-frequency content of its own was never lossy, and
  // the page has to say so — otherwise it calls every podcast a fake.
  await analyse(page, wav(44100, 2, sine(5000)))
  await expect(page.getByTestId('as-honest')).toContainText('The measurement is exact; the inference is not')
})

test('the DECODE rate is labelled as such, because the browser resamples', async ({ page }) => {
  // A 22.05 kHz file comes back from `decodeAudioData` at the AudioContext's
  // own rate — 44.1 here. Labelling that "sample rate" would state the file had
  // a property it does not, so the label and a note say what it really is. The
  // cutoff is unaffected: a 22 kHz source has nothing above 11 kHz to find.
  await analyse(page, wav(22050, 3, sine(4000)))
  await expect(page.getByTestId('as-rate')).toContainText('44.1')
  await expect(page.getByTestId('as-rate-note')).toContainText('not necessarily the file')
  await expect(page.getByTestId('as-duration')).toContainText('0:03')
})

test('it draws something, and the canvas is not blank', async ({ page }) => {
  await analyse(page, wav(44100, 2, sine(5000)))
  const { min, max } = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="as-canvas"]') as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let lo = 255, hi = 0
    for (let i = 0; i < d.length; i += 4) { if (d[i] < lo) lo = d[i]; if (d[i] > hi) hi = d[i] }
    return { min: lo, max: hi }
  })
  // Range, not distinct values: a tone is one bright line on a dark field, so
  // most pixels share a colour and counting them says nothing. A blank canvas
  // has min === max, which is the failure this must catch.
  expect(max - min).toBeGreaterThan(60)
})

test('a file that is not audio is refused with a reason', async ({ page }) => {
  await page.goto('/en/apps/audio-spectrum')
  await page.getByTestId('as-file').setInputFiles('e2e/fixtures/diff-small.png')
  await expect(page.getByTestId('file-error')).toBeVisible({ timeout: 20_000 })
})

test('works in Arabic', async ({ page }) => {
  await analyse(page, wav(44100, 2, sine(5000)), 'ar')
  await expect(page.getByTestId('as-verdict')).toContainText('جدار')
  const khz = await readNumber(page, 'as-cutoff')
  expect(khz).toBeGreaterThan(4.7)
})
