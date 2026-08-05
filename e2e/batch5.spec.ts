import { test, expect } from '@playwright/test'

test.describe('csv cleaner', () => {
  const MESSY = [
    'name, email ,city',
    ' Ahmed , a@example.com ,Riyadh',
    ' Ahmed , a@example.com ,Riyadh',
    '',
    'Fatimah,f@example.com,Jeddah',
  ].join('\n')

  test('removes duplicates, blank rows and stray spaces', async ({ page }) => {
    await page.goto('/en/apps/csv-clean')
    await page.getByTestId('cc-input').fill(MESSY)
    // Header + two distinct data rows.
    await expect(page.getByTestId('cc-rows')).toHaveText('3 rows')
    await expect(page.getByTestId('cc-removed')).toContainText('1 duplicate row')
    await expect(page.getByTestId('cc-removed')).toContainText('1 blank row')
    await expect(page.getByTestId('cc-output')).toHaveValue(/^name,email,city/)
    await expect(page.getByTestId('cc-output')).toHaveValue(/Ahmed,a@example.com,Riyadh/)
  })

  test('detects a semicolon separator', async ({ page }) => {
    await page.goto('/en/apps/csv-clean')
    await page.getByTestId('cc-input').fill('a;b;c\n1;2;3\n4;5;6')
    await expect(page.getByTestId('cc-cols')).toHaveText('3 columns')
  })

  test('drops a column that is entirely empty', async ({ page }) => {
    await page.goto('/en/apps/csv-clean')
    await page.getByTestId('cc-input').fill('a,b,c\n1,,3\n4,,6')
    await expect(page.getByTestId('cc-cols')).toHaveText('2 columns')
    await page.getByTestId('cc-dropcols').uncheck()
    await expect(page.getByTestId('cc-cols')).toHaveText('3 columns')
  })

  test('flags rows with the wrong number of fields', async ({ page }) => {
    await page.goto('/en/apps/csv-clean')
    await page.getByTestId('cc-input').fill('a,b,c\n1,2,3\n4,5')
    await expect(page.getByTestId('cc-ragged')).toBeVisible()
  })

  test('quoted fields containing the separator survive', async ({ page }) => {
    await page.goto('/en/apps/csv-clean')
    await page.getByTestId('cc-input').fill('name,note\nAhmed,"Riyadh, Saudi Arabia"')
    await expect(page.getByTestId('cc-cols')).toHaveText('2 columns')
    await expect(page.getByTestId('cc-output')).toHaveValue(/"Riyadh, Saudi Arabia"/)
  })
})

test.describe('data anonymizer', () => {
  test('masks emails, phones, IBANs and Saudi IDs', async ({ page }) => {
    await page.goto('/en/apps/data-anonymize')
    await page.getByTestId('da-sample').click()
    const out = page.getByTestId('da-output')
    await expect(out).not.toHaveValue(/ahmed@example\.com/)
    await expect(out).not.toHaveValue(/SA0380000000608010167519/)
    await expect(out).not.toHaveValue(/1023456789/)
    // The shape is kept, so the columns still line up.
    await expect(out).toHaveValue(/@example\.com/)
  })

  test('pseudonyms are stable, so the data still joins on itself', async ({ page }) => {
    await page.goto('/en/apps/data-anonymize')
    await page.getByTestId('da-input').fill('a@x.com\nb@x.com\na@x.com')
    await page.getByTestId('da-pseudonym').click()
    const value = await page.getByTestId('da-output').inputValue()
    const lines = value.trim().split('\n')
    expect(lines[0]).toBe(lines[2])
    expect(lines[0]).not.toBe(lines[1])
  })

  test('turning a category off leaves those values alone', async ({ page }) => {
    await page.goto('/en/apps/data-anonymize')
    await page.getByTestId('da-input').fill('reach me at ahmed@example.com')
    await expect(page.getByTestId('da-output')).not.toHaveValue(/ahmed@/)
    await page.getByTestId('da-email').uncheck()
    await expect(page.getByTestId('da-output')).toHaveValue(/ahmed@example\.com/)
  })

  test('a number that fails the Luhn check is not treated as a card', async ({ page }) => {
    await page.goto('/en/apps/data-anonymize')
    // A 16-digit order reference that is not a valid card number.
    await page.getByTestId('da-input').fill('order 1234567890123456 shipped')
    await page.getByTestId('da-phone').uncheck()
    await page.getByTestId('da-saudiId').uncheck()
    await expect(page.getByTestId('da-output')).toHaveValue(/1234567890123456/)
  })

  test('redact leaves nothing of the value', async ({ page }) => {
    await page.goto('/en/apps/data-anonymize')
    await page.getByTestId('da-input').fill('ahmed@example.com')
    await page.getByTestId('da-redact').click()
    await expect(page.getByTestId('da-output')).toHaveValue('[redacted]')
  })
})

test.describe('invisible characters', () => {
  test('finds a zero-width space and names it', async ({ page }) => {
    await page.goto('/en/apps/invisible-chars')
    await page.getByTestId('ic-input').fill('hello​world')
    await expect(page.getByTestId('ic-count')).toHaveText('1 invisible character found')
    await expect(page.getByTestId('ic-list')).toContainText('U+200B')
    await expect(page.getByTestId('ic-list')).toContainText('Zero-width space')
    await expect(page.getByTestId('ic-output')).toHaveValue('helloworld')
  })

  test('clean text is reported as clean', async ({ page }) => {
    await page.goto('/en/apps/invisible-chars')
    await page.getByTestId('ic-input').fill('perfectly ordinary text')
    await expect(page.getByTestId('ic-clean')).toBeVisible()
  })

  test('an unusual space becomes a normal one rather than vanishing', async ({ page }) => {
    await page.goto('/en/apps/invisible-chars')
    await page.getByTestId('ic-input').fill('a b')
    await expect(page.getByTestId('ic-list')).toContainText('Non-breaking space')
    await expect(page.getByTestId('ic-output')).toHaveValue('a b')
  })

  test('direction marks can be kept, since Arabic text needs them', async ({ page }) => {
    await page.goto('/en/apps/invisible-chars')
    await page.getByTestId('ic-input').fill('abc‏def')
    await expect(page.getByTestId('ic-output')).toHaveValue('abcdef')
    await page.getByTestId('ic-bidi').uncheck()
    await expect(page.getByTestId('ic-output')).toHaveValue('abc‏def')
  })

  test('groups repeats instead of listing each one', async ({ page }) => {
    await page.goto('/en/apps/invisible-chars')
    await page.getByTestId('ic-input').fill('a​b​c​d')
    await expect(page.getByTestId('ic-count')).toHaveText('3 invisible characters found')
    await expect(page.getByTestId('ic-list').locator('li')).toHaveCount(1)
    await expect(page.getByTestId('ic-list')).toContainText('× 3')
  })
})

test.describe('timezone planner', () => {
  test('shows a grid for the default places', async ({ page }) => {
    await page.goto('/en/apps/timezone-planner')
    await expect(page.getByTestId('tz-grid')).toBeVisible()
    // Three default zones, 24 hours each.
    await expect(page.getByTestId('tz-grid').locator('tbody tr')).toHaveCount(3)
    await expect(page.getByTestId('tz-grid').locator('tbody tr').first().locator('td')).toHaveCount(25)
  })

  test('adding and removing a place updates the grid', async ({ page }) => {
    await page.goto('/en/apps/timezone-planner')
    await page.getByTestId('tz-add').selectOption('Asia/Tokyo')
    await expect(page.getByTestId('tz-grid').locator('tbody tr')).toHaveCount(4)
    await page.getByTestId('tz-remove-Asia/Tokyo').click()
    await expect(page.getByTestId('tz-grid').locator('tbody tr')).toHaveCount(3)
  })

  test('two nearby zones have overlapping working hours', async ({ page }) => {
    await page.goto('/en/apps/timezone-planner')
    await page.evaluate(() => localStorage.setItem('bis-tz-zones', JSON.stringify(['Asia/Riyadh', 'Asia/Dubai'])))
    await page.reload()
    await expect(page.getByTestId('tz-best')).toBeVisible()
  })

  test('the chosen places survive a reload', async ({ page }) => {
    await page.goto('/en/apps/timezone-planner')
    await page.getByTestId('tz-add').selectOption('Asia/Tokyo')
    await expect(page.getByTestId('tz-grid').locator('tbody tr')).toHaveCount(4)
    await page.reload()
    await expect(page.getByTestId('tz-grid').locator('tbody tr')).toHaveCount(4)
  })
})

test.describe('calorie calculator', () => {
  test('computes BMR, TDEE and a target from Mifflin-St Jeor', async ({ page }) => {
    await page.goto('/en/apps/calorie-needs')
    // Defaults: male, 30y, 175cm, 78kg → BMR = 10*78 + 6.25*175 - 5*30 + 5 = 1728.75
    await expect(page.getByTestId('cn-bmr')).toHaveText('1,729')
    // TDEE at the 1.375 default multiplier.
    await expect(page.getByTestId('cn-tdee')).toHaveText('2,377')
    await expect(page.getByTestId('cn-target')).toHaveText('2,377')
  })

  test('the female equation differs by the documented constant', async ({ page }) => {
    await page.goto('/en/apps/calorie-needs')
    await page.getByTestId('cn-female').click()
    // 1728.75 - 5 - 161 = 1562.75
    await expect(page.getByTestId('cn-bmr')).toHaveText('1,563')
  })

  test('a weight-loss goal lowers the target and predicts a rate', async ({ page }) => {
    await page.goto('/en/apps/calorie-needs')
    await page.getByTestId('cn-goal').selectOption('-0.2')
    await expect(page.getByTestId('cn-target')).toHaveText('1,902')
    await expect(page.getByTestId('cn-rate')).toContainText('0.4')
  })

  test('reports BMI and the healthy range for the height', async ({ page }) => {
    await page.goto('/en/apps/calorie-needs')
    // 78 / 1.75^2 = 25.5 → overweight
    await expect(page.getByTestId('cn-bmi')).toContainText('25.5')
    await expect(page.getByTestId('cn-bmi')).toContainText('Overweight')
    await expect(page.getByTestId('cn-range')).toContainText('57–76 kg')
  })
})
