import { test, expect } from '@playwright/test'

// The Passphrase app became the password generator's "With dice" mode in
// November 2026. It opens on the dice; the device source is one tap away.
async function diceware(page: import('@playwright/test').Page, source: 'device' | 'dice' = 'device') {
  await page.goto('/en/apps/password-generator')
  await page.getByTestId('pw-mode-dice').click()
  await page.getByTestId(`pp-src-${source}`).click()
}

test.describe('passphrase generator', () => {
  test('generates a phrase and reports honest entropy', async ({ page }) => {
    await diceware(page)
    const phrase = page.getByTestId('pp-phrase')
    await expect(phrase).not.toBeEmpty()
    // 5 words from a 1296-word list = 5 × 10.34 = 51.7 → 52 bits.
    await expect(page.getByTestId('pp-bits')).toHaveText('52 bits')
    await expect(await phrase.innerText()).toMatch(/^[a-z]+(-[a-z]+){4}$/)
  })

  test('more words means more entropy', async ({ page }) => {
    await diceware(page)
    await page.getByTestId('pp-count').fill('8')
    // 8 × 10.34 = 82.7 → 83.
    await expect(page.getByTestId('pp-bits')).toHaveText('83 bits')
    await expect(page.getByTestId('pp-strength')).toHaveText('Strong')
  })

  test('regenerating gives a different phrase', async ({ page }) => {
    await diceware(page)
    const first = await page.getByTestId('pp-phrase').innerText()
    await page.getByTestId('pp-regen').click()
    await expect(page.getByTestId('pp-phrase')).not.toHaveText(first)
  })

  test('dice mode maps four rolls to a word, and rejects a bad roll', async ({ page }) => {
    await diceware(page, 'dice')
    await expect(page.getByTestId('pp-dice-how')).toContainText('Roll 4 dice')
    // Only three numbers for a four-dice list.
    await page.getByTestId('pp-rolls').fill('1 2 3')
    await page.getByTestId('pp-dice-add').click()
    await expect(page.getByTestId('pp-dice-error')).toBeVisible()
    // A seven is not a die face.
    await page.getByTestId('pp-rolls').fill('1 2 3 7')
    await page.getByTestId('pp-dice-add').click()
    await expect(page.getByTestId('pp-dice-error')).toBeVisible()
    // 1-1-1-1 is the first word in the list.
    await page.getByTestId('pp-rolls').fill('1 1 1 1')
    await page.getByTestId('pp-dice-add').click()
    await expect(page.getByTestId('pp-phrase')).toHaveText('able')
  })

  test('the generator itself uses the same lists, not a short one', async ({ page }) => {
    await page.goto('/en/apps/password-generator')
    await page.getByTestId('pw-mode-passphrase').click()
    await page.getByTestId('pw-list-words').selectOption('en')
    // Four words from 1,296 is 41 bits; the old 128-word list gave 28.
    await expect(page.getByTestId('pw-strength')).toContainText(/4[0-9] bits/)
  })

  test('passphrase now lives in the password generator', async ({ page }) => {
    await page.goto('/en/apps/passphrase')
    await expect(page).toHaveURL(/\/en\/apps\/password-generator\/?$/)
  })

  test('the Arabic list has fewer bits per word, and says so', async ({ page }) => {
    await diceware(page)
    await page.getByTestId('pp-list').selectOption('ar')
    // 216 words = 7.75 bits; 5 words = 38.75 → 39.
    await expect(page.getByTestId('pp-bits')).toHaveText('39 bits')
    await expect(page.getByTestId('pp-strength')).toHaveText('Weak')
  })
})

test.describe('colour blindness simulator', () => {
  test('finds a red/green pair that collapses for deuteranopia', async ({ page }) => {
    await page.goto('/en/apps/colour-blind')
    await expect(page.getByTestId('cb-problems')).toBeVisible()
    // The default palette has a green and a red, which is the classic failure.
    await expect(page.getByTestId('cb-problems')).toContainText('indistinguishable')
  })

  test('a blue-and-yellow palette survives', async ({ page }) => {
    await page.goto('/en/apps/colour-blind')
    // Reduce to two colours that stay distinct for red-green deficiencies.
    for (let i = 4; i >= 2; i--) await page.getByTestId(`cb-remove-${i}`).click()
    await page.getByTestId('cb-colour-0').fill('#0b3d91')
    await page.getByTestId('cb-colour-1').fill('#ffd400')
    await expect(page.getByTestId('cb-ok')).toBeVisible()
  })

  test('the simulated swatch differs from the original', async ({ page }) => {
    await page.goto('/en/apps/colour-blind')
    const sim = page.getByTestId('cb-sim-2') // the red
    const style = await sim.getAttribute('style')
    expect(style).toBeTruthy()
    expect(style).not.toContain('192, 57, 43')
  })

  test('switching deficiency changes the findings', async ({ page }) => {
    await page.goto('/en/apps/colour-blind')
    // Green vs red collapses for deuteranopia…
    await expect(page.getByTestId('cb-problems')).toContainText('#2e9e4f')
    // …but a blue-cone deficiency is a different failure, so that pair survives.
    await page.getByTestId('cb-kind-tritanopia').click()
    await expect(page.locator('[data-testid="cb-problems"], [data-testid="cb-ok"]').first()).not.toContainText('#2e9e4f')
  })
})

test.describe('svg optimiser', () => {
  const MESSY = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Some Editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="100" height="100" viewBox="0 0 100 100">
  <metadata>lots of rdf</metadata>
  <g inkscape:label="Layer 1">
    <path d="M 10.123456 20.987654 L 80.111111 20.987654 L 45.500000 80.250000 Z" fill="#1f5c3d"/>
  </g>
</svg>`
})

test.describe('batch watermark', () => {
  async function attach(page: import('@playwright/test').Page, count: number) {
    const files = []
    for (let i = 0; i < count; i++) {
      const dataUrl = await page.evaluate((n) => {
        const c = document.createElement('canvas')
        c.width = 400 + n * 100; c.height = 300
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#3f8f6d'; ctx.fillRect(0, 0, c.width, c.height)
        return c.toDataURL('image/png')
      }, i)
      files.push({ name: `photo-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') })
    }
    await page.getByTestId('bw-file').setInputFiles(files)
  }

  test('accepts several images and previews the first', async ({ page }) => {
    await page.goto('/en/apps/batch-watermark')
    await attach(page, 3)
    await expect(page.getByTestId('bw-count')).toHaveText('3 images')
    await expect(page.getByTestId('bw-preview')).toBeVisible()
  })

  test('downloads a zip with one file per image', async ({ page }) => {
    await page.goto('/en/apps/batch-watermark')
    await attach(page, 3)
    const dl = page.waitForEvent('download')
    await page.getByTestId('bw-download').click()
    const file = await dl
    expect(file.suggestedFilename()).toBe('watermarked.zip')
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const zip = Buffer.concat(chunks).toString('latin1')
    expect(zip).toContain('photo-0-watermarked.jpg')
    expect(zip).toContain('photo-2-watermarked.jpg')
  })

  test('clearing removes them all', async ({ page }) => {
    await page.goto('/en/apps/batch-watermark')
    await attach(page, 2)
    await expect(page.getByTestId('bw-count')).toHaveText('2 images')
    await page.getByTestId('bw-clear').click()
    await expect(page.getByTestId('bw-count')).toHaveCount(0)
  })

  test('says plainly that a watermark is not protection', async ({ page }) => {
    await page.goto('/en/apps/batch-watermark')
    await expect(page.getByText(/it is not protection/)).toBeVisible()
  })
})
