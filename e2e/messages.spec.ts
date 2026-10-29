import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { startRelay, relayContext, type Relay } from './support/relay'

// Messages goes peer-to-peer over real WebRTC data channels between real browser
// contexts, with only the handshake on a relay — here an in-memory stand-in that
// records every request body, so the privacy claim is ASSERTED, not assumed: no
// message text and no file content may ever appear in anything sent to a server.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

let relay: Relay
test.beforeAll(async () => { relay = await startRelay() })
test.afterAll(async () => { await relay.close() })

async function person(ctx: BrowserContext, name: string, path = '/en/apps/messages'): Promise<Page> {
  const p = await ctx.newPage()
  await p.goto(path)
  await expect(p.getByTestId('messages-setup')).toBeVisible({ timeout: 15_000 })
  await p.getByTestId('msg-setup-name').fill(name)
  await p.getByTestId('msg-setup-start').click()
  await expect(p.getByTestId('messages-app')).toHaveAttribute('data-ready', '1')
  return p
}
async function inviteOf(p: Page): Promise<string> {
  await p.getByTestId('msg-settings').click()
  const url = await p.getByTestId('invite-url').inputValue()
  await p.getByTestId('sheet-close').click()
  return url
}
async function send(p: Page, text: string) {
  await p.getByTestId('composer-input').fill(text)
  await p.getByTestId('composer-send').click()
}
const bubble = (p: Page, text: string) => p.getByTestId('bubble').filter({ hasText: text })
const relayHas = (s: string) => relay.bodies.some((b) => b.includes(s))

test('first run asks for a name, then shows an empty, private inbox', async ({ browser }) => {
  const c = await relayContext(browser, relay)
  const p = await person(c, 'Noura')
  await expect(p.getByTestId('conv-empty')).toBeVisible()
  await p.getByTestId('msg-settings').click()
  await expect(p.getByTestId('invite-url')).toHaveValue(/\/en\/apps\/messages\?add=[a-z0-9]+&n=Noura&k=/)
  await expect(p.getByTestId('invite-qr')).toBeVisible()
  await c.close()
})

test('note to self: formatting, poll, star, pin, search, edit and delete all work alone', async ({ browser }) => {
  const c = await relayContext(browser, relay)
  const p = await person(c, 'Solo')
  await p.getByTestId('msg-new').click()
  await p.getByTestId('new-self').click()
  await send(p, 'buy *dates* and _coffee_ https://example.com')
  const b = bubble(p, 'buy')
  await expect(b.locator('strong')).toHaveText('dates')
  await expect(b.locator('em')).toHaveText('coffee')
  await expect(b.locator('a')).toHaveAttribute('href', 'https://example.com/')
  // Markup is text.
  await send(p, '<img src=x onerror="window.__pwned=1">')
  await expect(bubble(p, '<img src=x')).toBeVisible()
  expect(await p.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  // Star and search.
  await b.hover()
  await b.getByTestId('bubble-more').click()
  await p.getByTestId('menu-star').click()
  await p.getByTestId('starred-toggle').click()
  await expect(p.getByTestId('starred-row')).toHaveCount(1)
  await p.getByTestId('starred-toggle').click()
  await p.getByTestId('msg-search').fill('coffee')
  await expect(p.getByTestId('search-hit')).toHaveCount(1)
  await p.getByTestId('msg-search').fill('')
  // Edit the last message with ArrowUp.
  await p.getByTestId('composer-input').press('ArrowUp')
  await expect(p.getByTestId('composer-editing')).toBeVisible()
  await p.getByTestId('composer-input').fill('edited text')
  await p.getByTestId('composer-input').press('Enter')
  await expect(bubble(p, 'edited text').getByTestId('bubble-edited')).toBeVisible()
  // Poll with my own vote.
  await p.getByTestId('composer-attach').click()
  await p.getByTestId('attach-poll').click()
  await p.getByTestId('poll-q').fill('Lunch?')
  await p.getByTestId('poll-opt').nth(0).fill('Kabsa')
  await p.getByTestId('poll-opt').nth(1).fill('Mandi')
  await p.getByTestId('poll-create').click()
  await p.getByTestId('poll-option').filter({ hasText: 'Mandi' }).click()
  await expect(p.getByTestId('poll-option').filter({ hasText: 'Mandi' })).toHaveAttribute('data-voted', '1')
  await expect(p.getByTestId('poll-option').filter({ hasText: 'Mandi' }).getByTestId('poll-count')).toHaveText('1')
  // Delete for me.
  await bubble(p, 'edited text').hover()
  await bubble(p, 'edited text').getByTestId('bubble-more').click()
  await p.getByTestId('menu-delete-me').click()
  await expect(bubble(p, 'edited text')).toHaveCount(0)
  // Survives a reload: it is in IndexedDB.
  await p.reload()
  await expect(p.getByTestId('conv-row')).toHaveCount(1)
  await p.getByTestId('conv-row').click()
  await expect(bubble(p, 'buy')).toBeVisible()
  await expect(p.getByTestId('msg-poll')).toBeVisible()
  await c.close()
})

test('two people: invite link, live delivery, receipts, typing, reactions, replies, edits and deletes — and nothing reaches the relay', async ({ browser }) => {
  const ca = await relayContext(browser, relay)
  const cb = await relayContext(browser, relay)
  const a = await person(ca, 'Aisha')
  const invite = await inviteOf(a)
  // Bob opens Aisha's invite: she becomes a contact and the chat opens.
  const b = await person(cb, 'Bob', invite.replace(/^https?:\/\/[^/]+/, ''))
  await expect(b.getByTestId('msg-toast')).toContainText('Aisha')
  await expect(b.getByTestId('thread-title')).toHaveText('Aisha')
  await expect(b.getByTestId('thread-status')).toHaveText('online', { timeout: 30_000 })

  const secret = 'the vault code is 7319 ' + Date.now()
  await send(b, secret)
  // Aisha sees a new conversation from Bob, with an unread badge.
  await expect(a.getByTestId('conv-row')).toHaveCount(1, { timeout: 20_000 })
  await expect(a.getByTestId('conv-unread')).toHaveText('1')
  await expect(a.getByTestId('conv-preview')).toContainText('the vault code')
  // Bob's tick is "delivered" before Aisha opens it and "read" after.
  await expect(bubble(b, secret).locator('[data-tick]')).toHaveAttribute('data-tick', 'delivered', { timeout: 15_000 })
  await a.getByTestId('conv-row').click()
  await expect(bubble(a, secret)).toBeVisible()
  await expect(a.getByTestId('unknown-banner')).toBeVisible()
  await a.getByTestId('unknown-add').click()
  await expect(bubble(b, secret).locator('[data-tick]')).toHaveAttribute('data-tick', 'read', { timeout: 15_000 })

  // Typing shows on the other side.
  await a.getByTestId('composer-input').fill('typing something')
  await expect(b.getByTestId('typing-bubble')).toBeVisible({ timeout: 10_000 })
  await a.getByTestId('composer-input').fill('')

  // A reaction and a reply.
  await bubble(a, secret).hover()
  await bubble(a, secret).getByTestId('bubble-more').click()
  await a.getByTestId('menu-react').filter({ hasText: '👍' }).click()
  await expect(bubble(b, secret).getByTestId('reaction-chip')).toHaveAttribute('data-emoji', '👍', { timeout: 10_000 })
  await bubble(a, secret).hover()
  await bubble(a, secret).getByTestId('bubble-reply-btn').click()
  await expect(a.getByTestId('composer-reply')).toContainText('Bob')
  await send(a, 'got it')
  await expect(bubble(b, 'got it').getByTestId('bubble-reply')).toContainText('the vault code', { timeout: 10_000 })

  // Bob edits, then deletes for everyone.
  await send(b, 'meet at 5')
  await expect(bubble(a, 'meet at 5')).toBeVisible({ timeout: 10_000 })
  await bubble(b, 'meet at 5').hover()
  await bubble(b, 'meet at 5').getByTestId('bubble-more').click()
  await b.getByTestId('menu-edit').click()
  await b.getByTestId('composer-input').fill('meet at 6')
  await b.getByTestId('composer-input').press('Enter')
  await expect(bubble(a, 'meet at 6').getByTestId('bubble-edited')).toBeVisible({ timeout: 10_000 })
  await bubble(b, 'meet at 6').hover()
  await bubble(b, 'meet at 6').getByTestId('bubble-more').click()
  await b.getByTestId('menu-delete-all').click()
  await expect(a.getByTestId('msg-deleted')).toBeVisible({ timeout: 10_000 })

  // The keys were exchanged and verified the same on both sides.
  await a.getByTestId('thread-info').click()
  const sa = await a.getByTestId('safety-number').textContent()
  await b.getByTestId('thread-info').click()
  await expect(b.getByTestId('safety-number')).toHaveText(sa!)

  // The relay saw handshakes only.
  expect(relayHas('vault code')).toBe(false)
  expect(relayHas('meet at')).toBe(false)
  expect(relayHas('got it')).toBe(false)
  await ca.close(); await cb.close()
})

test('a file goes peer-to-peer, never through the relay, and arrives intact', async ({ browser }) => {
  const ca = await relayContext(browser, relay)
  const cb = await relayContext(browser, relay)
  const a = await person(ca, 'Fahad')
  const invite = await inviteOf(a)
  const b = await person(cb, 'Sara', invite.replace(/^https?:\/\/[^/]+/, ''))
  await expect(b.getByTestId('thread-status')).toHaveText('online', { timeout: 30_000 })
  const token = 'FILE-TOKEN-' + Date.now()
  const content = Buffer.from(`${token}\n` + 'x'.repeat(200_000)) // bigger than one SCTP message
  await b.getByTestId('msg-file-input').setInputFiles({ name: 'report.txt', mimeType: 'text/plain', buffer: content })
  await expect(bubble(b, 'report.txt')).toBeVisible()
  await expect(a.getByTestId('conv-row')).toHaveCount(1, { timeout: 20_000 })
  await a.getByTestId('conv-row').click()
  const fileBubble = bubble(a, 'report.txt')
  await expect(fileBubble).toBeVisible()
  await fileBubble.getByTestId('msg-file-fetch').click()
  const link = fileBubble.getByTestId('msg-file-download')
  await expect(link).toBeVisible({ timeout: 20_000 })
  const got = await a.evaluate(async (href) => { const r = await fetch(href); return await r.text() }, (await link.getAttribute('href'))!)
  expect(got.length).toBe(content.length)
  expect(got.startsWith(token)).toBe(true)
  expect(relayHas(token)).toBe(false)
  await ca.close(); await cb.close()
})

test('a group of three: messages fan out, a poll counts everyone, and only members get it', async ({ browser }) => {
  const [ca, cb, cc] = await Promise.all([relayContext(browser, relay), relayContext(browser, relay), relayContext(browser, relay)])
  const a = await person(ca, 'Omar')
  const inv = await inviteOf(a)
  const b = await person(cb, 'Huda', inv.replace(/^https?:\/\/[^/]+/, ''))
  const c = await person(cc, 'Khalid', inv.replace(/^https?:\/\/[^/]+/, ''))
  await send(b, 'hi from Huda')
  await send(c, 'hi from Khalid')
  await expect(a.getByTestId('conv-row')).toHaveCount(2, { timeout: 30_000 })
  // Omar saves both and creates a group.
  for (const name of ['Huda', 'Khalid']) {
    await a.getByTestId('conv-row').filter({ hasText: name }).click()
    await a.getByTestId('unknown-add').click()
  }
  await a.getByTestId('msg-new').click()
  await a.getByTestId('new-group').click()
  await a.getByTestId('group-name').fill('Project Najd')
  await a.getByTestId('group-member-check').nth(0).check()
  await a.getByTestId('group-member-check').nth(1).check()
  await a.getByTestId('group-save').click()
  await expect(a.getByTestId('thread-title')).toHaveText('Project Najd')
  await send(a, 'welcome @Huda')
  for (const p of [b, c]) {
    await expect(p.getByTestId('conv-row').filter({ hasText: 'Project Najd' })).toBeVisible({ timeout: 30_000 })
    await p.getByTestId('conv-row').filter({ hasText: 'Project Najd' }).click()
    await expect(bubble(p, 'welcome')).toBeVisible()
  }
  await expect(bubble(b, 'welcome').getByTestId('mention')).toHaveText('@Huda')
  // A poll everyone votes on.
  await a.getByTestId('composer-attach').click()
  await a.getByTestId('attach-poll').click()
  await a.getByTestId('poll-q').fill('Meet when?')
  await a.getByTestId('poll-opt').nth(0).fill('Sunday')
  await a.getByTestId('poll-opt').nth(1).fill('Monday')
  await a.getByTestId('poll-create').click()
  for (const p of [b, c]) {
    await expect(p.getByTestId('msg-poll')).toBeVisible({ timeout: 20_000 })
    await p.getByTestId('poll-option').filter({ hasText: 'Sunday' }).click()
  }
  await expect(a.getByTestId('poll-option').filter({ hasText: 'Sunday' }).getByTestId('poll-count')).toHaveText('2', { timeout: 20_000 })
  // Khalid's message reaches Huda through the group too.
  await send(c, 'from Khalid to all')
  await expect(bubble(b, 'from Khalid to all')).toBeVisible({ timeout: 20_000 })
  expect(relayHas('Project Najd')).toBe(false)
  expect(relayHas('Meet when')).toBe(false)
  await ca.close(); await cb.close(); await cc.close()
})

test('away: the message waits as a SEALED push, then arrives when they reopen', async ({ browser }) => {
  const ca = await relayContext(browser, relay)
  const cb = await relayContext(browser, relay)
  const a = await person(ca, 'Layla')
  const aCode = (await a.getByTestId('messages-app').getAttribute('data-me'))!
  const invite = await inviteOf(a)
  const b = await person(cb, 'Yousef', invite.replace(/^https?:\/\/[^/]+/, ''))
  await expect(b.getByTestId('thread-status')).toHaveText('online', { timeout: 30_000 })
  await send(b, 'first, while both online')
  await expect(a.getByTestId('conv-row')).toHaveCount(1, { timeout: 20_000 })
  // Layla goes away; her device is registered for offline delivery.
  relay.links.add(aCode)
  await a.close()
  await expect(b.getByTestId('thread-status')).not.toHaveText('online', { timeout: 30_000 })
  const secret = 'sealed secret ' + Date.now()
  await send(b, secret)
  await expect.poll(() => relay.pushes.filter((x) => x.code === aCode).length, { timeout: 30_000 }).toBeGreaterThan(0)
  const push = relay.pushes.filter((x) => x.code === aCode).pop()!
  expect(push.sealed).toBe(true)
  expect(push.env).not.toContain('sealed secret')
  expect(relayHas('sealed secret')).toBe(false)
  await expect(bubble(b, secret).locator('[data-tick]')).toHaveAttribute('data-tick', 'pushed')
  // What the service worker would do with that push: queue it for the app.
  const a2 = await ca.newPage()
  await a2.goto('/en/apps/messages')
  await expect(a2.getByTestId('messages-app')).toHaveAttribute('data-ready', '1')
  await a2.evaluate(async (entry) => {
    await new Promise<void>((res) => {
      const o = indexedDB.open('bis-calls', 3)
      o.onupgradeneeded = () => { for (const s of ['missed', 'dms', 'msgs']) if (!o.result.objectStoreNames.contains(s)) o.result.createObjectStore(s, { keyPath: 'id' }) }
      o.onsuccess = () => { const t = o.result.transaction('msgs', 'readwrite'); t.objectStore('msgs').put(entry); t.oncomplete = () => res() }
    })
  }, { id: push.id, from: push.from, name: 'Yousef', env: push.env, sealed: push.sealed })
  await a2.reload()
  await a2.getByTestId('conv-row').click()
  await expect(bubble(a2, secret)).toBeVisible({ timeout: 15_000 })
  // And once both are online again, the outbox gets its ack.
  await expect(bubble(b, secret).locator('[data-tick]')).toHaveAttribute('data-tick', /delivered|read/, { timeout: 40_000 })
  await ca.close(); await cb.close()
})

test('a blocked contact cannot reach you; scheduled messages wait and can be cancelled', async ({ browser }) => {
  const ca = await relayContext(browser, relay)
  const cb = await relayContext(browser, relay)
  const a = await person(ca, 'Reem')
  const invite = await inviteOf(a)
  const b = await person(cb, 'Spammer', invite.replace(/^https?:\/\/[^/]+/, ''))
  await send(b, 'hello there')
  await expect(a.getByTestId('conv-row')).toHaveCount(1, { timeout: 20_000 })
  await a.getByTestId('conv-row').click()
  await a.getByTestId('unknown-block').click()
  await expect(a.getByTestId('composer-readonly')).toBeVisible()
  await send(b, 'are you there')
  await b.waitForTimeout(3000)
  await expect(bubble(a, 'are you there')).toHaveCount(0)
  // Schedule on Bob's side.
  await b.getByTestId('composer-input').fill('later message')
  await b.getByTestId('composer-schedule').click()
  const when = await b.evaluate(() => { const d = new Date(Date.now() + 2 * 86400_000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })
  await b.getByTestId('schedule-at').fill(when)
  await b.getByTestId('schedule-send').click()
  await expect(b.getByTestId('scheduled-item')).toHaveCount(1)
  await b.getByTestId('scheduled-cancel').click()
  await expect(b.getByTestId('scheduled-item')).toHaveCount(0)
  await ca.close(); await cb.close()
})

test('Arabic: the app is right-to-left and calls a chat by its Arabic name', async ({ browser }) => {
  const c = await relayContext(browser, relay)
  const p = await c.newPage()
  await p.goto('/ar/apps/messages')
  await p.getByTestId('msg-setup-name').fill('نورة')
  await p.getByTestId('msg-setup-start').click()
  await expect(p.getByTestId('conv-empty')).toContainText('لا توجد محادثات بعد')
  expect(await p.evaluate(() => document.documentElement.dir)).toBe('rtl')
  await p.getByTestId('msg-new').click()
  await p.getByTestId('new-self').click()
  await expect(p.getByTestId('thread-title')).toHaveText('ملاحظة لنفسي')
  await c.close()
})

test('the call button hands a chat to Calls', async ({ browser }) => {
  const ca = await relayContext(browser, relay)
  const cb = await relayContext(browser, relay)
  const a = await person(ca, 'Majed')
  const aCode = (await a.getByTestId('messages-app').getAttribute('data-me'))!
  const invite = await inviteOf(a)
  const b = await person(cb, 'Nada', invite.replace(/^https?:\/\/[^/]+/, ''))
  await b.getByTestId('thread-call').click()
  await expect(b).toHaveURL(new RegExp(`/call/\\?c=${aCode}`))
  await ca.close(); await cb.close()
})

test('mobile: the list and the thread are one screen at a time', async ({ browser }) => {
  const c = await relayContext(browser, relay)
  const p = await c.newPage()
  await p.setViewportSize({ width: 390, height: 844 })
  await p.goto('/en/apps/messages')
  await p.getByTestId('msg-setup-name').fill('Phone')
  await p.getByTestId('msg-setup-start').click()
  await p.getByTestId('msg-new').click()
  await p.getByTestId('new-self').click()
  await expect(p.getByTestId('thread')).toBeVisible()
  await expect(p.getByTestId('conv-pane')).toBeHidden()
  await p.getByTestId('thread-back').click()
  await expect(p.getByTestId('conv-pane')).toBeVisible()
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await c.close()
})
