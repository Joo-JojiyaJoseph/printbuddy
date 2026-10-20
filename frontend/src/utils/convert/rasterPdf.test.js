import { describe, it, expect } from 'vitest'
import { paginateRows, planSlices, pagesToPdf } from './rasterPdf'
import { conversionBlocker, needsConversion } from './detect'

describe('paginateRows', () => {
  it('keeps whole rows on a page and starts the next page at a row boundary', () => {
    expect(paginateRows([30, 30, 30, 30, 30], 100)).toEqual([[0, 3], [3, 5]])
  })
  it('gives a row taller than a page its own page', () => {
    expect(paginateRows([20, 500, 20], 100)).toEqual([[0, 1], [1, 2], [2, 3]])
  })
  it('handles no rows and one row', () => {
    expect(paginateRows([], 100)).toEqual([])
    expect(paginateRows([40], 100)).toEqual([[0, 1]])
  })
})

describe('planSlices', () => {
  it('cuts between blocks, never through one', () => {
    // blocks start at 10, 60, 110, 160 and the column ends at 210; pages hold 120 then 100
    const bands = planSlices([10, 60, 110, 160], 210, 120, 100)
    expect(bands).toEqual([[10, 110], [110, 210]])
  })
  it('cuts a block taller than a page at the page height', () => {
    expect(planSlices([0], 250, 100, 100)).toEqual([[0, 100], [100, 200], [200, 250]])
  })
  it('returns one band when it all fits', () => {
    expect(planSlices([5, 50], 90, 200, 200)).toEqual([[5, 90]])
  })
})

describe('pagesToPdf', () => {
  it('rejects an empty list', async () => { await expect(pagesToPdf([])).rejects.toThrow() })
})

describe('conversionBlocker', () => {
  const f = (name) => ({ name })
  it('explains how to save an old binary file in the new format', () => {
    expect(conversionBlocker(f('a.doc'), 'ole')).toMatch(/Save As → \.docx/)
    expect(conversionBlocker(f('a.xls'), 'ole')).toMatch(/Excel.*\.xlsx/)
    expect(conversionBlocker(f('a.ppt'), 'ole')).toMatch(/PowerPoint.*\.pptx/)
  })
  it('allows the modern formats and nothing else needs it', () => {
    for (const n of ['a.docx', 'a.xlsx', 'a.pptx']) expect(conversionBlocker(f(n), 'ooxml')).toBeNull()
    expect(needsConversion('ooxml')).toBe(true)
    expect(needsConversion('ole')).toBe(true)
    expect(needsConversion('pdf')).toBe(false)
    expect(needsConversion('txt')).toBe(false)
  })
})
