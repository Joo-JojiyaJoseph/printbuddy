import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { mergeInBrowser } from './mergeInBrowser'

const onePagePdf = async (n = 1) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([300, 400]); return d.save() }
// A 1x1 PNG.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

describe('mergeInBrowser', () => {
  it('joins PDFs and pictures in the given order into one PDF', async () => {
    const store = { a: await onePagePdf(2), b: PNG, c: await onePagePdf(1) }
    const docs = [{ original_name: 'a.pdf', kind: 'pdf', preview_url: 'a' }, { original_name: 'b.png', kind: 'png', preview_url: 'b' }, { original_name: 'c.pdf', kind: 'pdf', preview_url: 'c' }]
    const { file, pageCount } = await mergeInBrowser(docs, { load: async (u) => store[u] })
    expect(pageCount).toBe(4)
    expect(file.name).toBe('Combined (3 files).pdf')
    expect(file.type).toBe('application/pdf')
    const out = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()))
    expect(out.getPageCount()).toBe(4)
    expect(out.getPage(0).getSize()).toEqual({ width: 300, height: 400 })
    expect(Math.round(out.getPage(2).getSize().width)).toBe(595) // the picture sits on an A4 page
  })
  it('needs at least two files and ready ones', async () => {
    await expect(mergeInBrowser([{ kind: 'pdf', preview_url: 'a' }])).rejects.toThrow(/at least two/)
    await expect(mergeInBrowser([{ original_name: 'x', kind: 'pdf' }, { original_name: 'y', kind: 'pdf', preview_url: 'b' }], { load: async () => new Uint8Array() })).rejects.toThrow(/isn't ready/)
  })
  it('names a damaged PDF', async () => {
    const docs = [{ original_name: 'bad.pdf', kind: 'pdf', preview_url: 'x' }, { original_name: 'ok.pdf', kind: 'pdf', preview_url: 'y' }]
    await expect(mergeInBrowser(docs, { load: async () => new Uint8Array([1, 2, 3]) })).rejects.toThrow(/bad\.pdf/)
  })
})
