import { captureElement, makeStage } from './capture'
import { MAX_CONVERTED_PAGES, paginateRows } from './rasterPdf'

export const SHEET_LIMITS = { rows: 3000, cols: 40 }
const PAGE_W = 1000 // landscape-ish stage width in px; wide tables shrink to fit it
const PAGE_H = 700

const argb = (c) => (c?.argb && c.argb.length === 8 ? `#${c.argb.slice(2)}` : undefined)
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!m) return null
  return { c: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0), r: Number(m[2]) }
}

function cellCss(cell) {
  const f = cell.font || {}
  const css = ['padding:2px 6px', 'border:1px solid #d0d0d0', 'white-space:pre-wrap', 'vertical-align:top']
  if (f.bold) css.push('font-weight:700')
  if (f.italic) css.push('font-style:italic')
  if (f.size) css.push(`font-size:${Math.round(f.size * 1.333)}px`)
  if (argb(f.color)) css.push(`color:${argb(f.color)}`)
  const fill = cell.fill?.type === 'pattern' ? argb(cell.fill.fgColor) : undefined
  if (fill) css.push(`background:${fill}`)
  const al = cell.alignment?.horizontal
  const num = typeof cell.value === 'number'
  css.push(`text-align:${al && al !== 'general' ? al : num ? 'right' : 'left'}`)
  return css.join(';')
}

/** One worksheet → an HTML table split into row groups (kept as strings so the page loop stays simple). */
function sheetTable(ws) {
  const rows = Math.min(ws.rowCount, SHEET_LIMITS.rows + 1)
  const cols = Math.min(ws.columnCount, SHEET_LIMITS.cols + 1)
  if (ws.rowCount > SHEET_LIMITS.rows || ws.columnCount > SHEET_LIMITS.cols) {
    throw new Error(`The sheet "${ws.name}" is larger than ${SHEET_LIMITS.rows} rows × ${SHEET_LIMITS.cols} columns. Save the part you want as a PDF and upload that.`)
  }
  const span = new Map() // "r,c" -> [rowspan, colspan]; skipped cells -> null
  for (const ref of ws.model.merges ?? []) {
    const [a, b] = ref.split(':').map(parseRef)
    if (!a || !b) continue
    for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) span.set(`${r},${c}`, null)
    span.set(`${a.r},${a.c}`, [b.r - a.r + 1, b.c - a.c + 1])
  }
  const widths = []
  for (let c = 1; c <= cols; c++) { const col = ws.getColumn(c); widths.push(col.hidden ? 0 : Math.round((col.width || 9) * 7 + 5)) }
  const colgroup = `<colgroup>${widths.map((w) => (w ? `<col style="width:${w}px">` : '<col style="display:none">')).join('')}</colgroup>`
  const trs = []
  for (let r = 1; r <= rows; r++) {
    const row = ws.getRow(r)
    if (row.hidden) { trs.push(''); continue }
    let tds = ''
    for (let c = 1; c <= cols; c++) {
      if (!widths[c - 1]) continue
      const sp = span.get(`${r},${c}`)
      if (sp === null) continue
      const cell = row.getCell(c)
      const text = cell.text ?? ''
      tds += `<td${sp ? ` rowspan="${sp[0]}" colspan="${sp[1]}"` : ''} style="${cellCss(cell)}">${esc(text)}</td>`
    }
    const h = row.height ? `height:${Math.round(row.height * 1.333)}px;` : ''
    trs.push(`<tr style="${h}">${tds}</tr>`)
  }
  return { colgroup, trs, totalWidth: widths.reduce((a, b) => a + b, 0) || 1 }
}

/** Excel (.xlsx) → pictures: every sheet, split across pages by whole rows, shrunk to the page width. */
export async function xlsxToPages(buffer, { onProgress } = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const stage = makeStage(PAGE_W)
  const pages = []
  try {
    const sheets = wb.worksheets.filter((w) => w.state !== 'hidden' && w.state !== 'veryHidden' && w.actualRowCount > 0)
    if (!sheets.length) throw new Error('This workbook has no data to print.')
    for (let s = 0; s < sheets.length; s++) {
      const { colgroup, trs, totalWidth } = sheetTable(sheets[s])
      const scale = Math.min(1, PAGE_W / totalWidth)
      const wrap = (inner) => `<div style="width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;background:#fff;font:13px Arial,Helvetica,sans-serif;color:#111;padding:0"><div style="transform:scale(${scale});transform-origin:0 0;width:${totalWidth}px"><table style="border-collapse:collapse;table-layout:fixed;width:${totalWidth}px">${colgroup}${inner}</table></div></div>`
      // Measure real row heights with everything laid out, then split on row boundaries.
      stage.el.innerHTML = wrap(`<tbody>${trs.join('')}</tbody>`)
      const heights = [...stage.el.querySelectorAll('tr')].map((tr) => (tr.getBoundingClientRect().height || 0) * scale)
      const groups = paginateRows(heights, PAGE_H - 10).filter(([a, b]) => trs.slice(a, b).some(Boolean))
      for (const [a, b] of groups) {
        if (pages.length >= MAX_CONVERTED_PAGES) throw new Error(`This workbook needs more than ${MAX_CONVERTED_PAGES} pages. Save the part you want as a PDF and upload that.`)
        onProgress?.((s + pages.length / (pages.length + groups.length)) / sheets.length)
        stage.el.innerHTML = wrap(`<tbody>${trs.slice(a, b).join('')}</tbody>`)
        pages.push(await captureElement(stage.el.firstElementChild))
      }
    }
    return pages
  } finally { stage.remove() }
}
