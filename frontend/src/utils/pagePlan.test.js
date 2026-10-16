import { describe, it, expect } from 'vitest'
import * as P from './pagePlan'

describe('document page plan', () => {
  const n = 4
  it('starts as identity and produces no edits', () => {
    expect(P.isIdentity(P.identityPlan(n), n)).toBe(true)
    expect(P.toPageEdits(P.identityPlan(n), n)).toBeNull()
  })
  it('rotates both ways and wraps', () => {
    let p = P.identityPlan(n)
    p = P.rotatePage(p, 1, 1); p = P.rotatePage(p, 1, 1)
    expect(p[1].rot).toBe(180)
    expect(P.rotatePage(P.identityPlan(n), 0, -1)[0].rot).toBe(270)
    expect(P.rotatePage(P.rotatePage(P.identityPlan(n), 0, 1), 0, -1)[0].rot).toBe(0)
  })
  it('duplicates, adds blanks, moves and removes', () => {
    let p = P.duplicatePage(P.identityPlan(n), 0)
    expect(p.map((x) => x.src)).toEqual([1, 1, 2, 3, 4])
    p = P.addBlank(p, 4)
    expect(p.at(-1).src).toBeNull()
    p = P.movePage(p, 0, 1)
    expect(p.slice(0, 3).map((x) => x.src)).toEqual([1, 1, 2])
    expect(P.movePage(p, 0, -1)).toBe(p)
    p = P.removePage(P.identityPlan(n), 1)
    expect(p.map((x) => x.src)).toEqual([1, 3, 4])
  })
  it('never removes the last page with content', () => {
    const one = P.identityPlan(1)
    expect(P.removePage(one, 0)).toBe(one)
    const withBlank = P.addBlank(one, 0)
    expect(P.removePage(withBlank, 0)).toBe(withBlank)
    expect(P.removePage(withBlank, 1)).toHaveLength(1)
  })
  it('position applies to one page or all', () => {
    expect(P.setAlign(P.identityPlan(2), 1, 'tl').map((x) => x.align)).toEqual(['fit', 'tl'])
    expect(P.setAlignAll(P.identityPlan(2), 'fill').every((x) => x.align === 'fill')).toBe(true)
  })
  it('edits round-trip through the API shape', () => {
    const plan = P.removePage(P.identityPlan(n), 0)
    const edits = P.toPageEdits(plan, n)
    expect(edits.pages).toHaveLength(3)
    expect(P.fromPageEdits(edits, n)).toEqual(plan)
    expect(P.outputPageCount({ page_count: n }, edits)).toBe(3)
    expect(P.outputPageCount({ page_count: n }, null)).toBe(4)
  })
})

describe('undo / redo', () => {
  it('walks back and forward, and a new change clears redo', () => {
    let h = P.newHistory([1])
    h = P.commit(h, [1, 2]); h = P.commit(h, [1, 2, 3])
    h = P.undo(h); expect(h.present).toEqual([1, 2])
    h = P.redo(h); expect(h.present).toEqual([1, 2, 3])
    h = P.undo(P.undo(h)); h = P.commit(h, [9])
    expect(h.future).toEqual([])
    expect(P.redo(h)).toBe(h)
    expect(P.undo(P.newHistory(1))).toEqual(P.newHistory(1))
  })
  it('ignores no-op commits', () => {
    const h = P.newHistory([1])
    expect(P.commit(h, h.present)).toBe(h)
  })
})

describe('image layout', () => {
  const imgs = (...ids) => ids.map((document_id) => ({ document_id, rot: 0 }))
  it('packs images into sheets', () => {
    const s = { ...P.defaultSheet('a'), per_page: 2, images: imgs('a', 'b', 'c') }
    expect(P.sheetPageCount(s)).toBe(2)
    expect(P.sheetPages(s).map((c) => c.length)).toEqual([2, 1])
  })
  it('copies mode repeats each image on its own sheet', () => {
    const s = { ...P.defaultSheet('a'), per_page: 4, mode: 'copies', images: imgs('a') }
    expect(P.sheetPageCount(s)).toBe(1)
    expect(P.sheetPages(s)[0]).toHaveLength(4)
    expect(P.sheetPageCount({ ...s, images: imgs('a', 'b') })).toBe(2)
  })
  it('grids follow orientation', () => {
    expect(P.gridFor(2, false)).toEqual([1, 2])
    expect(P.gridFor(2, true)).toEqual([2, 1])
    expect(P.gridFor(4, false)).toEqual([2, 2])
    expect(P.gridFor(6, false)).toEqual([2, 3])
    expect(P.gridFor(6, true)).toEqual([3, 2])
  })
  it('untouched layout means no edits', () => {
    expect(P.toSheetEdits(P.defaultSheet('a'), 'a')).toBeNull()
    expect(P.toSheetEdits({ ...P.defaultSheet('a'), per_page: 2 }, 'a')).not.toBeNull()
    expect(P.toSheetEdits({ ...P.defaultSheet('a'), images: [{ document_id: 'a', rot: 90 }] }, 'a')).not.toBeNull()
  })
  it('paper ratios', () => {
    expect(P.paperRatio('A4', 'portrait')).toBeCloseTo(210 / 297)
    expect(P.paperRatio('A4', 'landscape')).toBeCloseTo(297 / 210)
  })
})

describe('validateEdits mirrors the server rules', () => {
  const doc = { id: 'a', kind: 'pdf', page_count: 3 }
  it('accepts a sane plan, rejects bad ones', () => {
    expect(P.validateEdits({ pages: [{ src: 1, rot: 0, align: 'fit' }, { src: null, rot: 0, align: 'fit' }] }, doc)).not.toBeNull()
    expect(() => P.validateEdits({ pages: [{ src: 4 }] }, doc)).toThrow(/does not exist/)
    expect(() => P.validateEdits({ pages: [] }, doc)).toThrow(/at least one/)
    expect(() => P.validateEdits({ pages: [{ src: null }] }, doc)).toThrow(/content/)
    expect(() => P.validateEdits({ pages: [{ src: 1 }, { src: 2 }] }, doc, [], 1)).toThrow(/limited/)
    expect(() => P.validateEdits({ sheet: {} }, doc)).toThrow(/only apply to images/)
  })
  it('validates image sheets', () => {
    const img = { id: 'a', kind: 'png', page_count: 1 }
    const ok = { sheet: { ...P.defaultSheet('a'), per_page: 2, images: [{ document_id: 'a', rot: 0 }, { document_id: 'b', rot: 0 }] } }
    expect(P.validateEdits(ok, img, ['a', 'b'])).toBe(ok)
    expect(() => P.validateEdits(ok, img, ['a'])).toThrow(/not available/)
    expect(() => P.validateEdits({ sheet: { ...ok.sheet, per_page: 3 } }, img, ['a', 'b'])).toThrow(/1, 2, 4 or 6/)
    expect(() => P.validateEdits({ sheet: { ...ok.sheet, images: [{ document_id: 'b', rot: 0 }] } }, img, ['a', 'b'])).toThrow(/must be part/)
    expect(() => P.validateEdits({ pages: [{ src: 1 }] }, img, ['a'])).toThrow(/do not apply/)
  })
  it('describes edits for the review screen', () => {
    expect(P.describeEdits({ pages: [{ src: 1, rot: 90 }, { src: null, rot: 0 }] })).toEqual([['Page edits', '2 pages · 1 rotated · 1 blank']])
    expect(P.describeEdits(null)).toEqual([])
    expect(P.describeEdits({ sheet: { per_page: 2, mode: 'copies', fit: 'fill', images: [{}] } })[0][1]).toContain('copies of each image')
  })
})
