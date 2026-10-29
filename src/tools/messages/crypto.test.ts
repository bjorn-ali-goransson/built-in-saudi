import { describe, it, expect } from 'vitest'
import { generateIdentity, exportPublic, importPublic, sharedKey, seal, open, safetyNumber, b64u } from './crypto'

describe('end-to-end envelope crypto', () => {
  it('two devices derive the same key and can read each other', async () => {
    const a = await generateIdentity()
    const b = await generateIdentity()
    const pa = await exportPublic(a.publicKey)
    const pb = await exportPublic(b.publicKey)
    const ka = await sharedKey(a.privateKey, pb, 'alice', 'bob')
    const kb = await sharedKey(b.privateKey, pa, 'bob', 'alice')
    const sealed = await seal(ka, 'مرحبا — hello 👋', 'alice')
    expect(sealed).not.toContain('hello')
    expect(await open(kb, sealed, 'alice')).toBe('مرحبا — hello 👋')
  })

  it('a different pair, a tampered ciphertext or the wrong sender all fail', async () => {
    const a = await generateIdentity()
    const b = await generateIdentity()
    const c = await generateIdentity()
    const pb = await exportPublic(b.publicKey)
    const pa = await exportPublic(a.publicKey)
    const ka = await sharedKey(a.privateKey, pb, 'alice', 'bob')
    const kc = await sharedKey(c.privateKey, pa, 'carol', 'alice')
    const sealed = await seal(ka, 'secret', 'alice')
    await expect(open(kc, sealed, 'alice')).rejects.toBeTruthy()
    const kb = await sharedKey(b.privateKey, pa, 'bob', 'alice')
    const bytes = b64u.dec(sealed); bytes[20] ^= 1
    await expect(open(kb, b64u.enc(bytes), 'alice')).rejects.toBeTruthy()
    await expect(open(kb, sealed, 'mallory')).rejects.toBeTruthy()
    // A key bound to one pair of addresses does not open another pair's envelopes.
    const kWrongPair = await sharedKey(b.privateKey, pa, 'bob', 'eve')
    await expect(open(kWrongPair, sealed, 'alice')).rejects.toBeTruthy()
  })

  it('every seal uses a fresh IV', async () => {
    const a = await generateIdentity()
    const k = await sharedKey(a.privateKey, await exportPublic(a.publicKey), 'x', 'x')
    expect(await seal(k, 'same', 'x')).not.toBe(await seal(k, 'same', 'x'))
  })

  it('private keys are not extractable', async () => {
    const a = await generateIdentity()
    await expect(crypto.subtle.exportKey('pkcs8', a.privateKey)).rejects.toBeTruthy()
  })

  it('safety numbers are symmetric and differ per pair', async () => {
    const [a, b, c] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()])
    const [pa, pb, pc] = await Promise.all([a, b, c].map((k) => exportPublic(k.publicKey)))
    expect(await safetyNumber(pa, pb)).toBe(await safetyNumber(pb, pa))
    expect(await safetyNumber(pa, pb)).not.toBe(await safetyNumber(pa, pc))
    expect(await safetyNumber(pa, pb)).toMatch(/^\d{5}( \d{5}){5}$/)
  })

  it('refuses a malformed public key', async () => {
    await expect(importPublic('abc')).rejects.toThrow('bad-public-key')
  })
})
