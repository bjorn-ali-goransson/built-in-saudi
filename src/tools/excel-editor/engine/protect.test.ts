import { describe, it, expect } from 'vitest'
import { legacyHash, spinHash, verify, protection, refusal } from './protect'
import type { SheetData } from './model'

describe('protection hashes, as Excel computes them', () => {
  it('the legacy 16-bit hash matches openpyxl', () => {
    // Values from openpyxl.utils.protection.hash_password — somebody else's implementation.
    expect(legacyHash('test')).toBe('CBEB')
    expect(legacyHash('password')).toBe('83AF')
    expect(legacyHash('a')).toBe('CE88')
    expect(legacyHash('كلمة')).toBe('8B61')
  })
  it('the spun SHA-512 hash matches Python hashlib', async () => {
    expect(await spinHash('secret', 'wnqhx5lYenydkuGXDP5Zrg==', 1000)).toBe('DiXnRDGL3Id+HXiwlNzDgxz12jj3C57Rj5fyTutYs89MX9pO+AJu1ebe6HcoN1BYN5+k10nC9sfdRUYmMzsmqw==')
  })
  it('a password set here opens with that password and no other', async () => {
    const p = await protection('open sesame')
    expect(p.hash!.spin).toBe(100000)
    expect(await verify(p, 'open sesame')).toBe(true)
    expect(await verify(p, 'open Sesame')).toBe(false)
    expect(await verify({ legacy: 'CBEB' }, 'test')).toBe(true)
    expect(await verify({}, 'anything')).toBe(true)
  }, 30000)
})

describe('what a protected sheet refuses', () => {
  const sheet = (): SheetData => ({ name: 'S', rows: 10, cols: 5, cells: { '0,0': { input: 'locked' }, '1,0': { input: '', fmt: { unlocked: true } } }, protect: { allow: { insertRows: true } } })
  it('a locked cell is refused, an unlocked one is not', () => {
    expect(refusal(sheet(), { k: 'cells', cells: [{ r: 0, c: 0 }] })).toBe('locked')
    expect(refusal(sheet(), { k: 'cells', cells: [{ r: 1, c: 0 }] })).toBeNull()
    // A cell that does not exist yet is locked, as in Excel.
    expect(refusal(sheet(), { k: 'cells', cells: [{ r: 5, c: 3 }] })).toBe('locked')
  })
  it('formatting and structure follow what the protection allows', () => {
    expect(refusal(sheet(), { k: 'fmt' })).toBe('format')
    expect(refusal(sheet(), { k: 'struct', axis: 'row', delta: 1 })).toBeNull()
    expect(refusal(sheet(), { k: 'struct', axis: 'row', delta: -1 })).toBe('structure')
    expect(refusal({ ...sheet(), protect: undefined }, { k: 'fmt' })).toBeNull()
  })
})
