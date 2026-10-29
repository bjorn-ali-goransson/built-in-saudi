import { test, expect, type Page } from '@playwright/test'
import { zipPart } from './helpers'
import { startRelay, relayContext, type Relay } from './support/relay'

// The seam between the office editors and Messages: a copy of the document, or
// a live session's link, handed to a conversation. What arrived is read back
// from Messages' OWN IndexedDB — the message and the stored bytes — rather than
// from the bubble that shows it.

type Msg = { id: string; conv: string; kind: string; file?: { id: string; name: string; size: number }; doc?: { kind: string; title: string; url: string } }
async function messagesDb(p: Page): Promise<{ msgs: Msg[]; blobs: { id: string; bytes: number[] }[] }> {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('bis-messages')
    r.onerror = () => reject(r.error)
    r.onsuccess = () => {
      const tx = r.result.transaction(['msgs', 'blobs'], 'readonly')
      const m = tx.objectStore('msgs').getAll()
      const b = tx.objectStore('blobs').getAll()
      tx.oncomplete = async () => {
        const blobs = await Promise.all((b.result as { id: string; blob: Blob }[]).map(async (x) => ({ id: x.id, bytes: Array.from(new Uint8Array(await x.blob.arrayBuffer())) })))
        resolve({ msgs: m.result as Msg[], blobs })
      }
    }
  }))
}

test('Send a copy in Messages: a first-time user names themselves, picks a chat, and the real .docx is stored there', async ({ page: p, context }) => {
  await p.goto('/en/apps/word-editor/')
  await p.getByTestId('office-new').click()
  await p.getByTestId('wd-editor').click()
  await p.keyboard.type('Quarterly figures for Omar')
  await p.getByTestId('office-title').fill('Q3 report')
  await expect(p.getByTestId('office-status')).toHaveAttribute('data-status', 'saved')
  await p.getByTestId('office-file').click()
  const [m] = await Promise.all([context.waitForEvent('page'), p.getByTestId('office-send-messages').click()])
  // Never opened Messages before: it asks for a name first, and the file waits.
  await expect(m.getByTestId('msg-setup-name')).toBeVisible({ timeout: 15_000 })
  await m.getByTestId('msg-setup-name').fill('Noura')
  await m.getByTestId('msg-setup-start').click()
  await expect(m.getByTestId('pick-conv-sheet')).toBeVisible()
  await m.getByTestId('pick-conv').filter({ hasText: 'Note to self' }).click()
  await expect(m.getByTestId('msg-toast')).toContainText('Sent to')
  // The editor tab is still there, untouched.
  await expect(p.getByTestId('wd-editor')).toContainText('Quarterly figures')
  await expect.poll(async () => (await messagesDb(m)).msgs.filter((x) => x.kind === 'file').length).toBe(1)
  const db = await messagesDb(m)
  const msg = db.msgs.find((x) => x.kind === 'file')!
  expect(msg.file!.name).toBe('Q3 report.docx')
  const bytes = Buffer.from(db.blobs.find((b) => b.id === msg.file!.id)!.bytes)
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  expect(zipPart(bytes, 'word/document.xml')).toContain('Quarterly figures for Omar')
  // The handover is TAKEN: reloading the tab does not offer to send it again.
  await m.reload()
  await expect(m.getByTestId('messages-app')).toHaveAttribute('data-ready', '1')
  await expect(m.getByTestId('pick-conv-sheet')).toHaveCount(0)
})

test('a handover that is gone says so, instead of opening an empty picker', async ({ page: p }) => {
  await p.goto('/en/apps/messages/?share=abcdefghij')
  await expect(p.getByTestId('msg-setup-name')).toBeVisible({ timeout: 15_000 })
  await p.getByTestId('msg-setup-name').fill('Noura')
  await p.getByTestId('msg-setup-start').click()
  await expect(p.getByTestId('msg-toast')).toContainText('Nothing to send')
  await expect(p.getByTestId('pick-conv-sheet')).toHaveCount(0)
})

test.describe('a live session, sent as a link', () => {
  let relay: Relay
  test.beforeAll(async () => { relay = await startRelay() })
  test.afterAll(async () => { await relay.close() })

  test('the card opens the join page for the same session, and carries the title', async ({ browser }) => {
    const ctx = await relayContext(browser, relay)
    const p = await ctx.newPage()
    await p.goto('/en/apps/powerpoint-editor/')
    await p.getByTestId('office-new').click()
    await p.getByTestId('office-title').fill('Board deck')
    await p.getByTestId('office-share').click()
    await p.getByTestId('collab-start').click()
    const link = new URL(await p.getByTestId('collab-link').inputValue())
    const [m] = await Promise.all([ctx.waitForEvent('page'), p.getByTestId('collab-send-messages').click()])
    await m.getByTestId('msg-setup-name').fill('Noura')
    await m.getByTestId('msg-setup-start').click()
    await m.getByTestId('pick-conv').filter({ hasText: 'Note to self' }).click()
    await expect.poll(async () => (await messagesDb(m)).msgs.filter((x) => x.kind === 'doc').length).toBe(1)
    const doc = (await messagesDb(m)).msgs.find((x) => x.kind === 'doc')!.doc!
    expect(doc).toEqual({ kind: 'powerpoint-editor', title: 'Board deck', url: link.pathname + link.search })
    // The bubble offers to open it, because it is a link to this site — and it lands on the join page.
    await m.getByTestId('msg-doc-open').click()
    await expect(m.getByTestId('office-join')).toBeVisible()
  })
})
