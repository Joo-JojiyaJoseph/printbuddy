import { captureElement, makeStage } from './capture'
import { MAX_CONVERTED_PAGES, planSlices } from './rasterPdf'

const px = (v, fallback = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : fallback }

/**
 * Word (.docx) → page pictures. docx-preview lays the file out as one tall "section" per page-break, so a long section is
 * cut into page-sized bands between paragraphs/tables (never through a line of text), keeping the page margins.
 */
export async function docxToPages(buffer, { onProgress } = {}) {
  const { renderAsync } = await import('docx-preview')
  const stage = makeStage(1000)
  try {
    await renderAsync(buffer, stage.el, stage.el, { inWrapper: false, breakPages: true, useBase64URL: true, ignoreLastRenderedPageBreak: false })
    const sheets = [...stage.el.querySelectorAll('section.docx')]
    if (!sheets.length) throw new Error('No pages were found in this Word file.')
    // work out every page first so the limit applies before any slow drawing starts
    const jobs = []
    for (const sec of sheets) {
      sec.style.margin = '0'
      sec.style.boxShadow = 'none'
      const cs = getComputedStyle(sec)
      const rect = sec.getBoundingClientRect()
      const pageH = px(cs.minHeight) || Math.round(rect.width * 1.4142)
      const padT = px(cs.paddingTop)
      const padB = px(cs.paddingBottom)
      if (rect.height <= pageH + 2) { jobs.push({ sec, whole: true }); continue }
      const blocks = [...(sec.querySelector('article')?.children ?? [])]
      const tops = blocks.length ? blocks.map((b) => b.getBoundingClientRect().top - rect.top) : [padT]
      const art = sec.querySelector('article')?.getBoundingClientRect()
      const end = Math.min(rect.height, (art ? art.bottom - rect.top : rect.height - padB) + 4) // to the bottom of the last block, not the footer gap
      const bands = planSlices(tops, end, pageH - padB, pageH - padT - padB)
      bands.forEach(([a, b], i) => jobs.push({ sec, region: { y: i === 0 ? 0 : a, height: i === 0 ? b : b - a }, pageH, offsetY: i === 0 ? 0 : padT }))
    }
    if (jobs.length > MAX_CONVERTED_PAGES) throw new Error(`This document has about ${jobs.length} pages, more than the ${MAX_CONVERTED_PAGES} we can prepare in the browser.`)
    const pages = []
    for (let i = 0; i < jobs.length; i++) {
      onProgress?.(i / jobs.length)
      const j = jobs[i]
      pages.push(await captureElement(j.sec, j.whole ? {} : { region: j.region, pageH: j.pageH, offsetY: j.offsetY }))
    }
    return pages
  } finally { stage.remove() }
}
