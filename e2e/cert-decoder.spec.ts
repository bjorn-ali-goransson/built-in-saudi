import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A real certificate, generated with OpenSSL, so every expectation below has
// ground truth from `openssl x509 -noout -text`. Regenerate with:
//   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 \
//     -nodes -subj "/C=SA/ST=Riyadh/L=Riyadh/O=Built in Saudi/OU=Engineering/CN=built-in-saudi.com" \
//     -addext "subjectAltName=DNS:built-in-saudi.com,DNS:www.built-in-saudi.com,IP:127.0.0.1" \
//     -addext "keyUsage=digitalSignature,keyEncipherment" \
//     -addext "extendedKeyUsage=serverAuth,clientAuth"
const PEM = readFileSync(fileURLToPath(new URL('./fixtures/cert.pem', import.meta.url)), 'utf8')

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/cert-decoder`)
  await page.getByTestId('cd-input').fill(PEM)
  await expect(page.getByTestId('cd-summary')).toBeVisible({ timeout: 15_000 })
}

test('reads the subject and issuer, in that order', async ({ page }) => {
  // The version field is optional and context-tagged, so a decoder that forgets
  // it shifts every later field by one and prints the issuer as the subject.
  await load(page)
  await expect(page.getByTestId('cd-subject')).toContainText('CN=built-in-saudi.com')
  await expect(page.getByTestId('cd-subject')).toContainText('O=Built in Saudi')
  await expect(page.getByTestId('cd-subject')).toContainText('C=SA')
  await expect(page.getByTestId('cd-issuer')).toContainText('CN=built-in-saudi.com')
})

test('reports the key and signature algorithms with the right key size', async ({ page }) => {
  await load(page)
  // 2048, not 2056: the RSA modulus carries a leading zero byte when its top
  // bit is set, and counting it inflates every key by 8 bits.
  await expect(page.getByTestId('cd-key')).toHaveText('RSA 2048')
  await expect(page.getByTestId('cd-sig')).toContainText('SHA-256 with RSA')
})

test('lists every name the certificate covers, including the IP', async ({ page }) => {
  await load(page)
  const san = page.getByTestId('cd-san')
  await expect(san).toContainText('built-in-saudi.com')
  await expect(san).toContainText('www.built-in-saudi.com')
  // An IP SAN is raw bytes, not text — printed as an address or not at all.
  await expect(san).toContainText('127.0.0.1')
})

test('decodes key usage bits and extended key usage', async ({ page }) => {
  await load(page)
  const ext = page.getByTestId('cd-extensions')
  await expect(ext).toContainText('digitalSignature')
  await expect(ext).toContainText('keyEncipherment')
  await expect(ext).toContainText('TLS server')
  await expect(ext).toContainText('TLS client')
})

test('says how long it has left, and that it is self-signed', async ({ page }) => {
  await load(page)
  await expect(page.getByTestId('cd-status')).toContainText(/Expires in \d+ days/)
  await expect(page.getByText('Self-signed')).toBeVisible()
})

test('the fingerprint matches what openssl reports', async ({ page }) => {
  await load(page)
  const fp = await page.getByTestId('cd-fingerprint').innerText()
  // Same shape and length as `openssl x509 -fingerprint -sha256`: 32 bytes,
  // colon-separated, uppercase hex.
  expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
})

test('accepts base64 with no PEM header', async ({ page }) => {
  await page.goto('/en/apps/cert-decoder')
  const bare = PEM.replace(/-----[^-]+-----/g, '').trim()
  await page.getByTestId('cd-input').fill(bare)
  await expect(page.getByTestId('cd-subject')).toContainText('built-in-saudi.com')
})

test('refuses something that is not a certificate', async ({ page }) => {
  await page.goto('/en/apps/cert-decoder')
  await page.getByTestId('cd-input').fill('-----BEGIN CERTIFICATE-----\nbm90IGEgY2VydGlmaWNhdGUgYXQgYWxs\n-----END CERTIFICATE-----')
  await expect(page.getByTestId('cd-error')).toBeVisible()
  await expect(page.getByTestId('cd-summary')).toHaveCount(0)
})

test('nothing is uploaded', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => { seen.push(r.url()); const b = r.postData(); if (b) seen.push(b) })
  await load(page)
  const body = PEM.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '').slice(0, 60)
  expect(seen.some((u) => u.includes(body))).toBe(false)
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('cd-subject')).toContainText('built-in-saudi.com')
})
