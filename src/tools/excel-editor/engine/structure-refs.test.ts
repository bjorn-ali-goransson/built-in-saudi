import { describe, expect, it } from 'vitest'
import { adjustRefsForStructure } from './formula'

/**
 * Reference rewriting when a sheet CHANGES SHAPE (#1341).
 *
 * The neighbouring `shift.test.ts` covers copy/paste, where every relative reference moves by a
 * fixed offset and `$` pins one in place. Structural change is the other rule, and getting the two
 * confused is how a spreadsheet quietly starts summing the wrong rows.
 */
const ins = (f: string, at: number, n = 1, sheet = 'Budget', on = 'Budget') =>
  adjustRefsForStructure(f, { formulaSheet: sheet, targetSheet: on, axis: 'row', at, delta: n })
const del = (f: string, at: number, n = 1, sheet = 'Budget', on = 'Budget') =>
  adjustRefsForStructure(f, { formulaSheet: sheet, targetSheet: on, axis: 'row', at, delta: -n })

describe('inserting a row', () => {
  it('moves references at or below the insertion, and leaves the ones above', () => {
    expect(ins('=B5', 2)).toBe('=B6') // row 5 (index 4) is below row 3 (index 2)
    expect(ins('=B2', 4)).toBe('=B2') // above the insertion — untouched
    expect(ins('=B3', 2)).toBe('=B4') // exactly AT the insertion point moves down
  })

  /**
   * THE DIFFERENCE FROM COPY/PASTE, and the one most likely to be got wrong: `$` anchors a
   * reference against being COPIED, not against the sheet changing under it. The cell has really
   * moved, so the anchored reference has to follow it or it now names someone else's number.
   */
  it('moves $-anchored references too, unlike a copy', () => {
    expect(ins('=$B$5', 2)).toBe('=$B$6')
    expect(ins('=$B5', 2)).toBe('=$B6')
    expect(ins('=B$5', 2)).toBe('=B$6')
  })

  it('grows a range when the row lands inside it', () => {
    // The endpoints are separate tokens, so each follows its own rule and the range widens.
    expect(ins('=SUM(B2:B5)', 2)).toBe('=SUM(B2:B6)')
    expect(ins('=SUM(B2:B5)', 0)).toBe('=SUM(B3:B6)') // entirely below — both move
    expect(ins('=SUM(B2:B5)', 9)).toBe('=SUM(B2:B5)') // entirely above — neither moves
  })

  it('inserts more than one row at a time', () => {
    expect(ins('=B5', 2, 3)).toBe('=B8')
  })
})

describe('deleting a row', () => {
  it('pulls later references up', () => {
    expect(del('=B5', 2)).toBe('=B4')
    expect(del('=SUM(B2:B9)', 2, 3)).toBe('=SUM(B2:B6)')
  })

  it('breaks a SINGLE reference to the row that was deleted, rather than silently repointing it', () => {
    // Quietly moving it to the next row down would make the formula read a different number with
    // no sign anything happened — the failure this is here to avoid.
    expect(del('=B3', 2)).toBe('=#REF!')
  })

  /**
   * A RANGE NARROWS instead of breaking, which is the whole difference between a feature people can
   * use and one they cannot. Deleting a line out of a budget is the commonest structural edit there
   * is; if every total turned into #REF! the first time, nobody would delete a second row.
   */
  it('narrows a range when a row inside it is deleted, keeping the total alive', () => {
    expect(del('=SUM(B2:B3)', 1)).toBe('=SUM(B2:B2)') // deleted the first row of the range
    expect(del('=SUM(B2:B4)', 2)).toBe('=SUM(B2:B3)') // deleted one in the middle
    expect(del('=SUM(B2:B4)', 3)).toBe('=SUM(B2:B3)') // deleted the last row of the range
  })

  it('only gives up when every row a range covered has gone', () => {
    // The dead range alone becomes #REF! — the formula keeps its shape, as Excel's does, so the
    // reader can see WHICH part broke instead of being handed a formula-shaped hole.
    expect(del('=SUM(B2:B3)', 1, 2)).toBe('=SUM(#REF!)')
  })

  it('leaves references above the deletion alone', () => {
    expect(del('=B2', 4)).toBe('=B2')
  })
})

describe('columns', () => {
  const insCol = (f: string, at: number) =>
    adjustRefsForStructure(f, { formulaSheet: 'S', targetSheet: 'S', axis: 'col', at, delta: 1 })
  it('moves columns and leaves rows alone', () => {
    expect(insCol('=B5', 0)).toBe('=C5')
    expect(insCol('=B5', 5)).toBe('=B5')
    expect(insCol('=SUM(A1:C1)', 1)).toBe('=SUM(A1:D1)')
  })
})

/**
 * WHICH SHEET CHANGED SHAPE. Without this the feature is actively dangerous: inserting a row in one
 * sheet would rewrite every other sheet's references to every other sheet.
 */
describe('cross-sheet references', () => {
  it('moves a reference that points AT the changed sheet', () => {
    expect(ins('=Budget!B5', 2, 1, 'Summary')).toBe('=Budget!B6')
  })

  it('leaves a reference that points at a DIFFERENT sheet', () => {
    expect(ins('=Rates!B5', 2, 1, 'Summary')).toBe('=Rates!B5')
  })

  it('treats a bare reference as belonging to the sheet the formula lives in', () => {
    expect(ins('=B5', 2, 1, 'Budget', 'Budget')).toBe('=B6')
    // The same formula, living somewhere else, must not move when Budget changes.
    expect(ins('=B5', 2, 1, 'Rates', 'Budget')).toBe('=B5')
  })

  it('understands a quoted sheet name', () => {
    expect(ins("='My Sheet'!B5", 2, 1, 'Summary', 'My Sheet')).toBe("='My Sheet'!B6")
    expect(ins("='My Sheet'!B5", 2, 1, 'Summary', 'Other')).toBe("='My Sheet'!B5")
  })
})

describe('what it must not touch', () => {
  it('leaves function names, numbers and string literals alone', () => {
    expect(ins('=SUM(B2:B5)*2', 0)).toBe('=SUM(B3:B6)*2')
    expect(ins('=IF(B5>0,"B5 is fine",0)', 2)).toBe('=IF(B6>0,"B5 is fine",0)')
  })

  it('returns anything that is not a formula unchanged', () => {
    expect(ins('12600', 0)).toBe('12600')
    expect(ins('Laptops', 0)).toBe('Laptops')
  })

  it('returns an unparseable formula unchanged rather than mangling it', () => {
    expect(ins('=SUM(((', 0)).toBe('=SUM(((')
  })
})
