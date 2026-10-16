import { rotateMark, stampActive } from './marks'

// Page edits (documents) and image layouts (images). Pure functions; the backend's PagePlan is the authority
// for validation and billing, this mirror only drives the editor UI and the demo (mock) API.

export const ALIGN_OPTIONS = [
  { value: 'fit', label: 'Fit page' },
  { value: 'center', label: 'Centre' },
  { value: 'tl', label: 'Top-left' },
  { value: 'fill', label: 'Fill page' },
]
export const PER_PAGE_OPTIONS = [1, 2, 4, 6]
/** Document pages (e.g. PowerPoint slides) printed on one sheet. */
export const PAGES_PER_SHEET = [1, 2, 4, 6, 9]
/** Printed sheets (sides) for `pages` pages at `perSheet` to a sheet. */
export const sheetsFor = (pages, perSheet = 1) => Math.ceil(pages / Math.max(1, perSheet))
export const isImageKind = (kind) => kind === 'jpg' || kind === 'png'

const PAPER_MM = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] }
export const paperMm = (size, orientation) => {
  const [w, h] = PAPER_MM[size] ?? PAPER_MM.A4
  return orientation === 'landscape' ? [h, w] : [w, h]
}
export const paperRatio = (size, orientation) => { const [w, h] = paperMm(size, orientation); return w / h }

// ---------- documents: ordered list of output pages ----------
export const identityPlan = (n) => Array.from({ length: n }, (_, i) => ({ src: i + 1, rot: 0, align: 'fit' }))
export const isIdentity = (plan, n) => plan.length === n && plan.every((p, i) => p.src === i + 1 && p.rot === 0 && p.align === 'fit' && !p.marks?.length)
export const hasContent = (plan) => plan.some((p) => p.src !== null)

// Turning a page also turns its marks with it, so text boxes stay on the words they were placed on.
export const rotatePage = (plan, i, dir) => plan.map((p, j) => (j === i
  ? { ...p, rot: (p.rot + (dir > 0 ? 90 : 270)) % 360, ...(p.marks?.length && { marks: p.marks.map((m) => rotateMark(m, dir)) }) }
  : p))
export const setMarks = (plan, i, marks) => plan.map((p, j) => (j === i ? { ...p, marks } : p))
export const duplicatePage = (plan, i) => [...plan.slice(0, i + 1), { ...plan[i] }, ...plan.slice(i + 1)]
export const addBlank = (plan, i) => [...plan.slice(0, i + 1), { src: null, rot: 0, align: 'fit' }, ...plan.slice(i + 1)]
export const removePage = (plan, i) => {
  const next = plan.filter((_, j) => j !== i)
  return next.length === 0 || !hasContent(next) ? plan : next // never leave nothing to print
}
export const movePage = (plan, i, d) => {
  const j = i + d
  if (j < 0 || j >= plan.length) return plan
  const next = [...plan];
  [next[i], next[j]] = [next[j], next[i]]
  return next
}
export const setAlign = (plan, i, align) => plan.map((p, j) => (j === i ? { ...p, align } : p))
export const setAlignAll = (plan, align) => plan.map((p) => ({ ...p, align }))

export const toPageEdits = (plan, n, stamp = null) => {
  const stampOn = stampActive(stamp)
  if (isIdentity(plan, n) && !stampOn) return null
  return {
    pages: plan.map(({ src, rot, align, marks }) => ({ src, rot, align, ...(marks?.length && { marks }) })),
    ...(stampOn && { stamp: { numbers: !!stamp.numbers, watermark: (stamp.watermark ?? '').trim() } }),
  }
}
export const fromPageEdits = (edits, n) => (edits?.pages ? edits.pages.map((p) => ({ ...p })) : identityPlan(n))

// ---------- undo / redo ----------
export const newHistory = (present) => ({ past: [], present, future: [] })
export const commit = (h, next) => (next === h.present ? h : { past: [...h.past.slice(-49), h.present], present: next, future: [] })
export const undo = (h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1), future: [h.present, ...h.future] } : h)
export const redo = (h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)

// ---------- images: several to a sheet, or copies of each ----------
export const defaultSheet = (primaryId) => ({ per_page: 1, mode: 'sequence', fit: 'fit', margin: 5, images: [{ document_id: primaryId, rot: 0 }] })
export const isDefaultSheet = (s, primaryId) =>
  s.per_page === 1 && s.fit === 'fit' && s.margin === 5 && s.images.length === 1
  && s.images[0].document_id === primaryId && s.images[0].rot === 0
export const toSheetEdits = (sheet, primaryId) => (isDefaultSheet(sheet, primaryId) ? null : { sheet })

export const sheetPageCount = (s) => (s.mode === 'copies' ? s.images.length : Math.ceil(s.images.length / s.per_page))
/** Sheets as arrays of cells ({document_id, rot}); copies mode repeats each image per_page times on its own sheet. */
export function sheetPages(s) {
  if (s.mode === 'copies') return s.images.map((img) => Array.from({ length: s.per_page }, () => img))
  const out = []
  for (let i = 0; i < s.images.length; i += s.per_page) out.push(s.images.slice(i, i + s.per_page))
  return out
}
/** [columns, rows] */
export const gridFor = (perPage, landscape) => ({ 1: [1, 1], 2: landscape ? [2, 1] : [1, 2], 4: [2, 2], 6: landscape ? [3, 2] : [2, 3], 9: [3, 3] }[perPage] ?? [1, 1])

// ---------- shared helpers ----------
export const outputPageCount = (doc, edits) =>
  edits?.pages ? edits.pages.length : edits?.sheet ? sheetPageCount(edits.sheet) : doc.page_count

export function describeEdits(edits) {
  if (edits?.pages) {
    const rotated = edits.pages.filter((p) => p.rot).length
    const blank = edits.pages.filter((p) => p.src === null).length
    const bits = [`${edits.pages.length} page${edits.pages.length === 1 ? '' : 's'}`]
    if (rotated) bits.push(`${rotated} rotated`)
    if (blank) bits.push(`${blank} blank`)
    const marks = edits.pages.reduce((n, p) => n + (p.marks?.length ?? 0), 0)
    if (marks) bits.push(`${marks} text/highlight mark${marks === 1 ? '' : 's'}`)
    if (edits.stamp?.numbers) bits.push('page numbers')
    if (edits.stamp?.watermark) bits.push(`watermark “${edits.stamp.watermark}”`)
    return [['Page edits', bits.join(' · ')]]
  }
  if (edits?.sheet) {
    const s = edits.sheet
    return [['Layout', `${s.per_page} per page · ${s.mode === 'copies' ? 'copies of each image' : 'different images'} · ${s.images.length} image${s.images.length === 1 ? '' : 's'} · ${s.fit === 'fill' ? 'fill' : 'fit'}`]]
  }
  return []
}

/** Mirror of the backend PagePlan::normalize rules (mock API + client pre-checks). Throws Error with a customer-safe message. */
export function validateEdits(edits, doc, imageIds = [], maxPages = 500) {
  if (!edits || (!edits.pages && !edits.sheet)) return null
  if (isImageKind(doc.kind)) {
    if (edits.pages?.length) throw new Error('Page edits do not apply to images.')
    const s = edits.sheet
    if (!PER_PAGE_OPTIONS.includes(s.per_page)) throw new Error('Choose 1, 2, 4 or 6 images per page.')
    if (!s.images?.length || s.images.length > 50) throw new Error('Choose between 1 and 50 images.')
    if (!s.images.every((i) => imageIds.includes(i.document_id))) throw new Error('One of the selected images is not available.')
    if (!s.images.some((i) => i.document_id === doc.id)) throw new Error('The image you are editing must be part of the layout.')
    if (!Number.isInteger(s.margin) || s.margin < 0 || s.margin > 20) throw new Error('Margin must be between 0 and 20 mm.')
    if (sheetPageCount(s) > maxPages) throw new Error(`A print job is limited to ${maxPages} pages.`)
    return edits
  }
  if (edits.sheet) throw new Error('Image layouts only apply to images.')
  const pages = edits.pages ?? []
  if (!pages.length) throw new Error('Keep at least one page to print.')
  if (pages.length > maxPages) throw new Error(`A print job is limited to ${maxPages} pages.`)
  if (pages.some((p) => p.src !== null && (!Number.isInteger(p.src) || p.src < 1 || p.src > doc.page_count))) throw new Error('One of the edited pages does not exist in the document.')
  if (!pages.some((p) => p.src !== null)) throw new Error('Keep at least one page with content.')
  return edits
}

/**
 * What an UNEDITED order prints like, for the preview only (the order itself keeps `edits: null`).
 * Mirrors the server's mapping: scaling fit = whole page to the sheet edge, fill = cover, actual = real size.
 */
export function previewEdits(doc, scaling, pageCount) {
  if (isImageKind(doc.kind)) return { sheet: { ...defaultSheet(doc.id), fit: scaling === 'fill' ? 'fill' : 'fit' } }
  const align = scaling === 'fill' ? 'fill' : scaling === 'actual' ? 'actual' : 'edge'
  return { pages: Array.from({ length: pageCount }, (_, i) => ({ src: i + 1, rot: 0, align })) }
}
