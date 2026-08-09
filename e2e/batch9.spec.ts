import { test, expect } from '@playwright/test'

// Pin the browser zone: these planners render on the device clock, so the exact
// times below only hold for a known zone (the lesson from batch 7).
test.use({ timezoneId: 'UTC' })

test.describe('blood sugar converter', () => {
  test('converts mg/dL to mmol/L by the molar factor', async ({ page }) => {
    await page.goto('/en/apps/glucose-units')
    await page.getByTestId('gl-value').fill('180')
    // 180 / 18.0182 = 9.99
    await expect(page.getByTestId('gl-mmol')).toContainText('10.0')
    await page.getByTestId('gl-unit').selectOption('mmol')
    await page.getByTestId('gl-value').fill('10')
    await expect(page.getByTestId('gl-mgdl')).toContainText('180')
  })

  test('bands depend on when the reading was taken', async ({ page }) => {
    await page.goto('/en/apps/glucose-units')
    await page.getByTestId('gl-value').fill('130')
    // 130 fasting is the prediabetes/diabetes boundary region…
    await expect(page.getByTestId('gl-band')).toContainText('diabetes range')
    await page.getByTestId('gl-context').selectOption('postMeal')
    // …but 130 two hours after a meal is normal.
    await expect(page.getByTestId('gl-band')).toContainText('usual range')
  })

  test('converts HbA1c both ways and gives an eAG', async ({ page }) => {
    await page.goto('/en/apps/glucose-units')
    await page.getByTestId('gl-mode-a1c').click()
    await page.getByTestId('gl-value').fill('7')
    // (7 - 2.15) * 10.929 = 53; eAG = 28.7*7 - 46.7 = 154 mg/dL
    await expect(page.getByTestId('gl-a1cmmol')).toContainText('53')
    await expect(page.getByTestId('gl-eag')).toContainText('154')
  })

  test('a dangerously low reading says what to do now', async ({ page }) => {
    await page.goto('/en/apps/glucose-units')
    await page.getByTestId('gl-value').fill('45')
    await expect(page.getByTestId('disclaimer')).toContainText('997')
  })

  test('a very high reading warns about ketoacidosis', async ({ page }) => {
    await page.goto('/en/apps/glucose-units')
    await page.getByTestId('gl-value').fill('350')
    await expect(page.getByTestId('disclaimer')).toContainText('ketoacidosis')
  })
})

test.describe('sleep cycle', () => {
  test('offers four bedtimes, 90 minutes apart', async ({ page }) => {
    await page.goto('/en/apps/sleep-cycle')
    await page.getByTestId('sc-time').fill('06:00')
    const slots = page.getByTestId('sc-times').locator('> div')
    await expect(slots).toHaveCount(4)
    // 6 cycles = 9h + 15min to fall asleep → 20:45 the previous evening.
    await expect(page.getByTestId('sc-slot-6')).toContainText('20:45')
    await expect(page.getByTestId('sc-slot-5')).toContainText('22:15')
  })

  test('shows Fajr and the last third of the night', async ({ page }) => {
    await page.goto('/en/apps/sleep-cycle')
    await expect(page.getByTestId('sc-fajr')).toHaveText(/\d\d:\d\d/)
    await expect(page.getByTestId('sc-qiyam')).toHaveText(/\d\d:\d\d/)
  })

  test('changing city changes the prayer times', async ({ page }) => {
    await page.goto('/en/apps/sleep-cycle')
    const first = await page.getByTestId('sc-fajr').textContent()
    await page.getByTestId('sc-city').selectOption({ index: 3 })
    await expect(page.getByTestId('sc-fajr')).not.toHaveText(first!)
  })
})

test.describe('water intake', () => {
  test('starts from body weight and adds for the heat', async ({ page }) => {
    await page.goto('/en/apps/water-intake')
    await page.getByTestId('wi-weight').fill('80')
    await page.getByTestId('wi-climate').selectOption('temperate')
    // 80 × 35 ml = 2.8 L
    await expect(page.getByTestId('wi-litres')).toContainText('2.8')
    await page.getByTestId('wi-climate').selectOption('extreme')
    // ×1.4 = 3.92
    await expect(page.getByTestId('wi-litres')).toContainText('3.9')
  })

  test('outdoor work and exercise add on top', async ({ page }) => {
    await page.goto('/en/apps/water-intake')
    await page.getByTestId('wi-weight').fill('70')
    await page.getByTestId('wi-climate').selectOption('temperate')
    const before = await page.getByTestId('wi-litres').textContent()
    await page.getByTestId('wi-outdoors').check()
    await expect(page.getByTestId('wi-litres')).not.toHaveText(before!)
    await expect(page.getByTestId('wi-breakdown')).toContainText('Sun exposure')
  })

  test('fasting shows how to fit it between iftar and suhoor', async ({ page }) => {
    await page.goto('/en/apps/water-intake')
    await page.getByTestId('wi-fasting').check()
    await expect(page.getByTestId('wi-fastingnote')).toContainText('iftar')
  })

  test('an unsafely high total is called out', async ({ page }) => {
    await page.goto('/en/apps/water-intake')
    await page.getByTestId('wi-weight').fill('120')
    await page.getByTestId('wi-climate').selectOption('extreme')
    await page.getByTestId('wi-activity').selectOption('high')
    await page.getByTestId('wi-hours').fill('4')
    await expect(page.getByTestId('wi-toomuch')).toBeVisible()
  })
})

test.describe('hijri age', () => {
  test('gives both ages, with the Hijri one ahead', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('1990-01-01')
    const hijri = Number(await page.getByTestId('ha-hijri').textContent())
    const greg = Number(await page.getByTestId('ha-greg').textContent())
    expect(greg).toBeGreaterThan(30)
    // ~1 extra Hijri year per 33 Gregorian ones.
    expect(hijri).toBeGreaterThan(greg)
    expect(hijri - greg).toBeLessThan(3)
  })

  test('accepts a Hijri date of birth', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-cal-hijri').click()
    await page.getByTestId('ha-h-year').fill('1410')
    await expect(page.getByTestId('ha-hijri')).toHaveText(/^3[0-9]$/)
    await expect(page.getByTestId('ha-born')).toContainText(/19(89|90)/)
  })

  test('reports days lived and the next Hijri birthday', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('2000-06-15')
    const days = Number((await page.getByTestId('ha-days').textContent())!.replace(/,/g, ''))
    expect(days).toBeGreaterThan(9000)
    await expect(page.getByTestId('ha-next')).toBeVisible()
  })

  test('a future date of birth is refused', async ({ page }) => {
    await page.goto('/en/apps/hijri-age')
    await page.getByTestId('ha-date').fill('2099-01-01')
    await expect(page.getByTestId('ha-future')).toBeVisible()
  })
})

test.describe('medicine timing', () => {
  test('spaces doses across the waking day', async ({ page }) => {
    await page.goto('/en/apps/medicine-schedule')
    await page.getByTestId('ms-wake').fill('07:00')
    await page.getByTestId('ms-doses').selectOption('3')
    await expect(page.getByTestId('ms-times').locator('> div')).toHaveCount(3)
    // 16 waking hours over 3 doses → 8 hours apart.
    await expect(page.getByTestId('ms-gap')).toContainText('8.0')
  })

  test('fasting squeezes the schedule into the iftar-to-suhoor window', async ({ page }) => {
    await page.goto('/en/apps/medicine-schedule')
    await page.getByTestId('ms-doses').selectOption('3')
    const dayGap = await page.getByTestId('ms-gap').textContent()
    await page.getByTestId('ms-fasting').check()
    await expect(page.getByTestId('ms-window')).toBeVisible()
    await expect(page.getByTestId('ms-gap')).not.toHaveText(dayGap!)
    // The night window is far shorter than a waking day.
    const gap = parseFloat((await page.getByTestId('ms-gap').textContent())!.replace(/[^\d.]/g, ''))
    expect(gap).toBeLessThan(6)
  })

  // The fasting window is Maghrib -> Fajr, so its LENGTH is seasonal: about 8.5
  // hours at midsummer in Riyadh and about 11.5 in midwinter. Four doses at a
  // 3-hour minimum therefore genuinely fit in a winter night and genuinely do
  // not in a summer one — so a test that just asks "is it flagged today" is
  // asserting the season, and it duly failed the first time a run happened to
  // land in August. The tool was right; the test was wrong. Same family as the
  // id-expiry cases built in UTC. Both ends of the rule are pinned instead.
  test('four doses are flagged in a short summer night', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-06-21T10:00:00+03:00') })
    await page.goto('/en/apps/medicine-schedule')
    await page.getByTestId('ms-fasting').check()
    await page.getByTestId('ms-doses').selectOption('4')
    await expect(page.getByTestId('ms-tootight')).toBeVisible()
  })

  test('and are not flagged in a long winter one', async ({ page }) => {
    // Without this half the warning could fire on every night of the year and
    // the case above would still pass, which would make it a warning nobody
    // could act on.
    await page.clock.install({ time: new Date('2026-12-21T10:00:00+03:00') })
    await page.goto('/en/apps/medicine-schedule')
    await page.getByTestId('ms-fasting').check()
    await page.getByTestId('ms-doses').selectOption('4')
    await expect(page.getByTestId('ms-doses')).toHaveValue('4')
    await expect(page.getByTestId('ms-tootight')).toHaveCount(0)
  })

  test('fasting adds the ruling note alongside the medical one', async ({ page }) => {
    await page.goto('/en/apps/medicine-schedule')
    await page.getByTestId('ms-fasting').check()
    // Two notes: the medical one, then the ruling one. The shared testid is
    // deliberately not overridable, so they are distinguished by data-kind.
    const notes = page.getByTestId('disclaimer')
    await expect(notes).toHaveCount(2)
    await expect(notes.nth(0)).toHaveAttribute('data-kind', 'medical')
    await expect(notes.nth(1)).toHaveAttribute('data-kind', 'religious')
  })
})
