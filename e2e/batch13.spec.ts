import { test, expect } from '@playwright/test'

test.describe('metronome', () => {
  test('tempo controls agree with each other', async ({ page }) => {
    await page.goto('/en/apps/metronome')
    await expect(page.getByTestId('mt-bpm')).toHaveText('100')
    await expect(page.getByTestId('mt-name')).toContainText('Andante')
    await page.getByTestId('mt-adj-5').click()
    await expect(page.getByTestId('mt-bpm')).toHaveText('105')
    await page.getByTestId('mt-adj--1').click()
    await expect(page.getByTestId('mt-bpm')).toHaveText('104')
    await page.getByTestId('mt-slider').fill('180')
    await expect(page.getByTestId('mt-bpm')).toHaveText('180')
    await expect(page.getByTestId('mt-name')).toContainText('Presto')
  })

  test('the tempo cannot be pushed out of range', async ({ page }) => {
    await page.goto('/en/apps/metronome')
    await page.getByTestId('mt-slider').fill('30')
    for (let i = 0; i < 3; i++) await page.getByTestId('mt-adj--5').click()
    await expect(page.getByTestId('mt-bpm')).toHaveText('30')
  })

  test('the beat dots follow the time signature', async ({ page }) => {
    await page.goto('/en/apps/metronome')
    await expect(page.getByTestId('mt-beats').locator('> span')).toHaveCount(4)
    await page.getByTestId('mt-meter').selectOption('7')
    await expect(page.getByTestId('mt-beats').locator('> span')).toHaveCount(7)
  })

  test('starting and stopping actually runs the audio clock', async ({ page }) => {
    await page.goto('/en/apps/metronome')
    await page.getByTestId('mt-toggle').click()
    await expect(page.getByTestId('mt-toggle')).toContainText('Stop')
    // A beat lands within a bar at 100bpm; the dot proves the scheduler fired.
    await expect(page.locator('[data-testid^="mt-dot-"].bg-gold-500, [data-testid^="mt-dot-"].bg-green-600').first())
      .toBeVisible({ timeout: 4000 })
    await page.getByTestId('mt-toggle').click()
    await expect(page.getByTestId('mt-toggle')).toContainText('Start')
  })

  test('tapping sets the tempo, and faster tapping sets a faster one', async ({ page }) => {
    // Wall-clock through a browser carries the click round-trip, so an exact BPM
    // is not something this environment can promise. What IS invariant is the
    // direction: tapping quicker must read quicker.
    await page.goto('/en/apps/metronome')
    const tapAt = async (gap: number, times: number) => {
      for (let i = 0; i < times; i++) {
        await page.getByTestId('mt-tap').click()
        if (i < times - 1) await page.waitForTimeout(gap)
      }
      return Number(await page.getByTestId('mt-bpm').innerText())
    }
    const slow = await tapAt(600, 5)
    await page.waitForTimeout(2100) // long enough to count as a fresh attempt
    const fast = await tapAt(300, 5)
    expect(fast).toBeGreaterThan(slow)
    // And both land somewhere musically plausible rather than at a bound.
    expect(slow).toBeGreaterThan(40)
    expect(fast).toBeLessThan(300)
  })
})

test.describe('tap bpm', () => {
  test('needs a couple of taps before it will guess', async ({ page }) => {
    await page.goto('/en/apps/bpm-tap')
    await expect(page.getByTestId('bt-bpm')).toHaveText('—')
    await expect(page.getByTestId('bt-more')).toBeVisible()
  })

  test('counts the taps and reads a plausible tempo', async ({ page }) => {
    await page.goto('/en/apps/bpm-tap')
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('bt-tap').click()
      if (i < 5) await page.waitForTimeout(500)
    }
    await expect(page.getByTestId('bt-count')).toContainText('6 taps')
    const bpm = Number(await page.getByTestId('bt-bpm').innerText())
    // Half-second taps, plus whatever the click cost — musical, not exact.
    expect(bpm).toBeGreaterThan(60)
    expect(bpm).toBeLessThan(140)
  })

  test('the delay times agree with the tempo it is showing', async ({ page }) => {
    await page.goto('/en/apps/bpm-tap')
    // Short gaps on purpose: the tool treats a gap over two seconds as a new
    // attempt, and under parallel load a longer gap can genuinely stretch past
    // that and reset the sequence mid-test.
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('bt-tap').click()
      if (i < 4) await page.waitForTimeout(200)
    }
    await expect(page.getByTestId('bt-derived')).toBeVisible()
    // This is the invariant worth testing, and it holds whatever the latency was:
    // the quarter-note delay must be 60000/BPM, or the two readings disagree and
    // one of them is lying to whoever is dialling in a delay pedal.
    const bpm = Number(await page.getByTestId('bt-bpm').innerText())
    const text = await page.getByTestId('bt-derived').innerText()
    const quarter = Number(text.match(/(\d+) ms/)![1])
    expect(Math.abs(quarter - 60000 / bpm)).toBeLessThan(2)
    // And the eighth is exactly half the quarter.
    const all = [...text.matchAll(/(\d+) ms/g)].map((m) => Number(m[1]))
    expect(Math.abs(all[1] - all[0] / 2)).toBeLessThanOrEqual(1)
  })

  test('reports how steady the tapping was', async ({ page }) => {
    await page.goto('/en/apps/bpm-tap')
    // Deliberately uneven gaps — the reading should not present itself as solid.
    for (const g of [200, 900, 300, 800, 250]) {
      await page.getByTestId('bt-tap').click()
      await page.waitForTimeout(g)
    }
    await page.getByTestId('bt-tap').click()
    await expect(page.getByTestId('bt-quality')).toContainText(/Uneven|uneven/)
  })

  test('reset clears everything', async ({ page }) => {
    await page.goto('/en/apps/bpm-tap')
    for (let i = 0; i < 3; i++) { await page.getByTestId('bt-tap').click(); await page.waitForTimeout(400) }
    await expect(page.getByTestId('bt-count')).toContainText('3 taps')
    await page.getByTestId('bt-reset').click()
    await expect(page.getByTestId('bt-count')).toContainText('0 taps')
    await expect(page.getByTestId('bt-bpm')).toHaveText('—')
  })
})

test.describe('tuner', () => {
  test('offers instrument presets including the oud', async ({ page }) => {
    await page.goto('/en/apps/tuner')
    // `allInnerTexts()` does NOT auto-wait: on a lazily-loaded tool that has
    // not rendered yet it returns [], and `[].join(' ')` is '' — which fails
    // with "received empty string" rather than a timeout, so the cause reads
    // like a missing preset. Wait for the control to exist first.
    await expect(page.getByTestId('tu-tuning')).toBeVisible()
    const options = await page.getByTestId('tu-tuning').locator('option').allInnerTexts()
    expect(options.join(' ')).toContain('Oud')
    expect(options.join(' ')).toContain('Guitar')
  })

  test('the reference pitch is adjustable and clamped', async ({ page }) => {
    await page.goto('/en/apps/tuner')
    await expect(page.getByTestId('tu-a4')).toHaveValue('440')
    await page.getByTestId('tu-a4').fill('442')
    await expect(page.getByTestId('tu-a4')).toHaveValue('442')
    await page.getByTestId('tu-a4').fill('900')
    await expect(page.getByTestId('tu-a4')).toHaveValue('466')
  })

  test('explains why it does not use FFT peak-picking', async ({ page }) => {
    await page.goto('/en/apps/tuner')
    await expect(page.getByText(/autocorrelation/)).toBeVisible()
    await expect(page.getByText(/octave high/)).toBeVisible()
  })

  test('a refused microphone is explained, not left silent', async ({ page, context }) => {
    // Deny the permission so getUserMedia rejects.
    await context.clearPermissions()
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: () => Promise.reject(new Error('denied')) },
        configurable: true,
      })
    })
    await page.goto('/en/apps/tuner')
    await page.getByTestId('tu-toggle').click()
    await expect(page.getByTestId('tu-error')).toContainText('never leaves this page')
  })
})

test.describe('sound meter', () => {
  test('says plainly it is not a calibrated instrument', async ({ page }) => {
    await page.goto('/en/apps/sound-meter')
    const note = page.getByTestId('disclaimer')
    await expect(note).toHaveAttribute('data-kind', 'official')
    await expect(note).toContainText('NOT a sound level meter in the regulatory sense')
  })

  test('a refused microphone is explained', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: () => Promise.reject(new Error('denied')) },
        configurable: true,
      })
    })
    await page.goto('/en/apps/sound-meter')
    await page.getByTestId('sm-toggle').click()
    await expect(page.getByTestId('sm-error')).toBeVisible()
  })

  test('a browser with no getUserMedia at all is handled', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    })
    await page.goto('/en/apps/sound-meter')
    await page.getByTestId('sm-toggle').click()
    await expect(page.getByTestId('sm-error')).toContainText('will not give a page microphone access')
  })
})
