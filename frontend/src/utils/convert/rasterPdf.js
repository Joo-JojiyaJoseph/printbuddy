// Builds a PDF out of page pictures (used by every in-browser Office converter) with pdf-lib, loaded only when needed.
export const MAX_CONVERTED_PAGES = 120

/**
 * @param {{jpeg: Uint8Array, wPt: number, hPt: number}[]} pages  one JPEG per page and the page size in points
 * @returns {Promise<Uint8Array>}
 */
export async function pagesToPdf(pages) {
  if (!pages.length) throw new Error('Nothing to put in the PDF.')
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  for (const p of pages) {
    const img = await pdf.embedJpg(p.jpeg)
    const page = pdf.addPage([p.wPt, p.hPt])
    page.drawImage(img, { x: 0, y: 0, width: p.wPt, height: p.hPt })
  }
  return pdf.save()
}

/** Row ranges [start, end) that fit a page of `pageH`; a row taller than a page still gets its own page. */
export function paginateRows(heights, pageH) {
  const out = []
  let start = 0
  let used = 0
  heights.forEach((h, i) => {
    if (i > start && used + h > pageH) { out.push([start, i]); start = i; used = 0 }
    used += h
  })
  if (heights.length > start) out.push([start, heights.length])
  return out
}

/**
 * Where to cut one long column of blocks into pages. `tops` are the blocks' top edges, `end` the bottom of the last one,
 * `firstH` / `nextH` the usable height of the first / later pages. Whole blocks stay together; a block taller than a page
 * is cut at the page height. Returns [start, end) bands in the same units.
 */
export function planSlices(tops, end, firstH, nextH) {
  const bands = []
  let start = tops[0] ?? 0
  let limit = firstH
  const close = (to) => { bands.push([start, to]); start = to; limit = nextH }
  tops.forEach((t, i) => {
    const bottom = tops[i + 1] ?? end
    while (bottom - start > limit) {
      if (t > start) { close(t); continue } // earlier blocks fill this page: this block starts the next one
      close(start + limit) // a single block taller than a page
    }
  })
  if (end > start) bands.push([start, end])
  return bands
}
