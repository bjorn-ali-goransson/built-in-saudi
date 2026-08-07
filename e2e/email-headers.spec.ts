import { test, expect } from '@playwright/test'

// A realistic header block: folded Received lines, an RFC 2047 encoded subject,
// a Reply-To on a different domain, and a DKIM failure. Written out here rather
// than kept as a fixture so every value an assertion checks is visible.
const HEADERS = [
  'Delivered-To: someone@built-in-saudi.com',
  'Received: from mx.built-in-saudi.com (mx.built-in-saudi.com [10.0.0.9])',
  '\tby inbox.built-in-saudi.com with ESMTPS id abc123',
  '\tfor <someone@built-in-saudi.com>; Tue, 3 Mar 2026 09:00:30 +0300',
  'Received: from relay.example.net (relay.example.net [203.0.113.7])',
  '\tby mx.built-in-saudi.com with ESMTP id def456; Tue, 3 Mar 2026 09:00:10 +0300',
  'Received: from sender.example.com (sender.example.com [198.51.100.4])',
  '\tby relay.example.net with SMTP id ghi789; Tue, 3 Mar 2026 09:00:00 +0300',
  'Authentication-Results: mx.built-in-saudi.com; spf=pass smtp.mailfrom=example.com;',
  '\tdkim=fail reason="signature verification failed"; dmarc=fail (p=NONE)',
  'From: "Billing" <billing@example.com>',
  'Reply-To: refunds@totally-different.example.org',
  'To: someone@built-in-saudi.com',
  'Subject: =?UTF-8?B?2YHYp9iq2YjYsdipINis2K/Zitiv2Kk=?=',
  'Date: Tue, 3 Mar 2026 09:00:00 +0300',
  'Message-ID: <abc-123@example.com>',
].join('\n')

async function load(page: import('@playwright/test').Page, locale = 'en') {
  await page.goto(`/${locale}/apps/email-headers`)
  await page.getByTestId('eh-input').fill(HEADERS)
  await expect(page.getByTestId('eh-summary')).toBeVisible()
}

test('puts the hops in the order the message actually travelled', async ({ page }) => {
  // Received headers are PREPENDED by each server, so the raw block reads
  // newest-first. Showing them in file order shows the journey backwards.
  await load(page)
  await expect(page.getByTestId('eh-hop-1')).toContainText('sender.example.com')
  await expect(page.getByTestId('eh-hop-2')).toContainText('relay.example.net')
  await expect(page.getByTestId('eh-hop-3')).toContainText('mx.built-in-saudi.com')
})

test('computes the delay at each hop and the total', async ({ page }) => {
  await load(page)
  // 09:00:00 → 09:00:10 → 09:00:30
  await expect(page.getByTestId('eh-hop-2')).toContainText('10s')
  await expect(page.getByTestId('eh-hop-3')).toContainText('20s')
  await expect(page.getByTestId('eh-total')).toHaveText('30s')
})

test('unfolds continuation lines rather than losing them', async ({ page }) => {
  await load(page)
  // The "by …" of each hop is on a folded continuation line; without unfolding
  // it is simply absent.
  await expect(page.getByTestId('eh-hop-1')).toContainText('relay.example.net')
  await expect(page.getByTestId('eh-hop-3')).toContainText('inbox.built-in-saudi.com')
})

test('decodes an RFC 2047 encoded subject', async ({ page }) => {
  await load(page)
  // Base64 UTF-8 for "فاتورة جديدة" — the messages a reader most needs to
  // understand are exactly the ones that arrive encoded.
  await expect(page.getByTestId('eh-subject')).toHaveText('فاتورة جديدة')
})

test('reports the SPF, DKIM and DMARC verdicts separately', async ({ page }) => {
  await load(page)
  await page.getByTestId('eh-tab-auth').click()
  await expect(page.getByTestId('eh-spf')).toHaveText('pass')
  await expect(page.getByTestId('eh-dkim')).toHaveText('fail')
  await expect(page.getByTestId('eh-dmarc')).toHaveText('fail')
})

test('flags a reply address on another domain, without calling it fraud', async ({ page }) => {
  await load(page)
  const flag = page.getByTestId('eh-flag-reply-to')
  await expect(flag).toContainText('example.com → totally-different.example.org')
  // The wording has to leave room for a helpdesk, which legitimately does this.
  await expect(flag).toContainText('Legitimate for a helpdesk')
  await expect(page.getByTestId('eh-flag-auth-fail')).toContainText('DKIM, DMARC')
})

test('lists every header when asked', async ({ page }) => {
  await load(page)
  await page.getByTestId('eh-tab-all').click()
  await expect(page.getByTestId('eh-all')).toContainText('Message-ID')
  await expect(page.getByTestId('eh-all')).toContainText('Delivered-To')
})

test('text that is not headers says so', async ({ page }) => {
  await page.goto('/en/apps/email-headers')
  await page.getByTestId('eh-input').fill('hello, this is just a note with no colon lines')
  await expect(page.getByTestId('eh-not-headers')).toBeVisible()
})

test('nothing pasted is put on the wire', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => { seen.push(r.url()); const b = r.postData(); if (b) seen.push(b) })
  await load(page)
  expect(seen.some((u) => u.includes('totally-different.example.org'))).toBe(false)
  expect(seen.some((u) => u.includes('someone%40built-in-saudi.com') || u.includes('someone@built-in-saudi.com'))).toBe(false)
})

test('works in Arabic too', async ({ page }) => {
  await load(page, 'ar')
  await expect(page.getByTestId('eh-subject')).toHaveText('فاتورة جديدة')
})
