import { describe, it, expect } from 'vitest'
import { stripExt, ensureExt } from './docStore'

describe('file names as titles', () => {
  it('drops every extension the editors open, and nothing else', () => {
    for (const ext of ['docx', 'docm', 'dotx', 'odt', 'xlsx', 'xlsm', 'ods', 'pptx', 'pptm', 'potx', 'ppsx', 'odp', 'csv', 'md', 'markdown', 'html'])
      expect(stripExt(`Q3 budget.${ext}`), ext).toBe('Q3 budget')
    expect(stripExt('v1.2 notes')).toBe('v1.2 notes')
  })
  it('a title becomes a file name with one extension, never two', () => {
    expect(ensureExt(stripExt('budget.ods'), '.xlsx')).toBe('budget.xlsx')
    expect(ensureExt('a/b: c', '.ods')).toBe('a b c.ods')
  })
})
