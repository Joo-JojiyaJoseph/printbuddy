import { rotateMark, stampActive } from './marks'

// Page edits (documents) and image layouts (images). Pure functions; the backend's PagePlan is the authority
// for validation and billing, this mirror only drives the editor UI and the demo (mock) API.

/** Where a page sits on the paper. `edge` (whole page to the sheet edge) is the default and is what an unedited document prints as. */
export const ALIGN_OPTIONS = [
  { value: 'edge', label: 'Fit page' },
  { value: 'center', label: 'Centre' },
  { value: 'tl', label: 'Top-left' },
  { value: 'fill', label: 'Fill page' },
  { value: 'actual', label: 'Actual size' },
]
const ALIGNS = ['edge', 'fit', 'center', 'tl', 'fill', 'actual'] // 'fit' (small margin) is still accepted from older orders
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
export const identityPlan = (n) => Array.from({ length: n }, (_, i) => ({ src: i + 1, rot: 0, align: 'edge' }))
export const isIdentity = (plan, n) => plan.length === n && plan.every((p, i) => p.src === i + 1 && p.rot === 0 && p.align === 'edge' && !p.marks?.length)
export const hasContent = (plan) => plan.some((p) => p.src !== null)

// Turning a page also turns its marks with it, so text boxes stay on the words they were placed on.
export const rotatePage = (plan, i, dir) => plan.map((p, j) => (j === i
  ? { ...p, rot: (p.rot + (dir > 0 ? 90 : 270)) % 360, ...(p.marks?.length && { marks: p.marks.map((m) => rotateMark(m, dir)) }) }
  : p))
export const setMarks = (plan, i, marks) => plan.map((p, j) => (j === i ? { ...p, marks } : p))
export const duplicatePage = (plan, i) => [...plan.slice(0, i + 1), { ...plan[i] }, ...plan.slice(i + 1)]
export const addBlank = (plan, i) => [...plan.slice(0, i + 1), { src: null, rot: 0, align: 'edge' }, ...plan.slice(i + 1)]
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

// ---------- double-sided: the front and the back of each sheet are positioned separately ----------
/** Which side printed sheet number `sheetIndex` (0-based) lands on when printing double-sided: 1st sheet = front, 2nd = back, ... */
export const sideOfSheet = (sheetIndex) => (sheetIndex % 2 === 0 ? 'front' : 'back')
/** Side of output page `i` when `perSheet` pages share a sheet. */
export const sideOfPage = (i, perSheet = 1) => sideOfSheet(Math.floor(i / Math.max(1, perSheet)))
/** Give every page that prints on `side` (all fronts, or all backs) the same position. */
export const setAlignSide = (plan, side, align, perSheet = 1) => plan.map((p, i) => (sideOfPage(i, perSheet) === side ? { ...p, align } : p))
/** The position shared by the pages on `side` (the first one's when they differ), or null when that side has no pages. */
export const alignOfSide = (plan, side, perSheet = 1) => plan.find((_, i) => sideOfPage(i, perSheet) === side)?.align ?? null

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
/** A dragged picture stays inside half a cell of the middle; its size can go from 20% to 400%. Same limits as the server. */
export const MAX_OFFSET = 0.5
export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 4
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round4 = (v) => Math.round(v * 1e4) / 1e4
/** Crop: each side trimmed away as a fraction of the upright picture. Each axis keeps at least a tenth. */
export const CROP_MAX_TRIM = 0.9
export const CROP_SIDES = ['l', 't', 'r', 'b']
/** A clean crop (4 decimals, never trimming past the limit), or null when nothing is trimmed. */
export function normCrop(c) {
  if (!c) return null
  const o = {}
  for (const k of CROP_SIDES) o[k] = round4(clamp(Number.isFinite(c[k]) ? c[k] : 0, 0, CROP_MAX_TRIM))
  for (const [a, b] of [['l', 'r'], ['t', 'b']]) {
    const over = o[a] + o[b] - CROP_MAX_TRIM
    if (over > 1e-9) { o[a] = round4(o[a] - over / 2); o[b] = round4(o[b] - over / 2) }
  }
  return CROP_SIDES.some((k) => o[k] > 0) ? o : null
}
/**
 * A crop drawn on the picture as it is displayed (after the customer's turn of `rot` degrees) as a crop of the upright picture,
 * which is what is stored and printed. Turning is clockwise, so `fromDisplayed` undoes it and `toDisplayed` applies it.
 */
export function cropFromDisplayed(c, rot) {
  if (!c) return null
  return normCrop({ 0: c, 90: { l: c.t, t: c.r, r: c.b, b: c.l }, 180: { l: c.r, t: c.b, r: c.l, b: c.t }, 270: { l: c.b, t: c.l, r: c.t, b: c.r } }[((rot % 360) + 360) % 360])
}
export const cropToDisplayed = (c, rot) => cropFromDisplayed(c, (360 - rot) % 360)
/** Place a picture: `x`/`y` = distance from the middle of its cell as a fraction of the cell, `zoom` = size, `crop` = trimmed sides. Defaults are dropped. */
export function placeImage(img, patch = {}) {
  const { x = img.x ?? 0, y = img.y ?? 0, zoom = img.zoom ?? 1 } = patch
  const crop = 'crop' in patch ? normCrop(patch.crop) : normCrop(img.crop)
  const { x: _x, y: _y, zoom: _z, crop: _c, ...rest } = img
  const nx = round4(clamp(x, -MAX_OFFSET, MAX_OFFSET)), ny = round4(clamp(y, -MAX_OFFSET, MAX_OFFSET)), nz = round4(clamp(zoom, ZOOM_MIN, ZOOM_MAX))
  return { ...rest, ...(nx !== 0 && { x: nx }), ...(ny !== 0 && { y: ny }), ...(nz !== 1 && { zoom: nz }), ...(crop && { crop }) }
}
export const isPlaced = (img) => !!(img.x || img.y || (img.zoom && img.zoom !== 1) || normCrop(img.crop))
export const defaultSheet = (primaryId) => ({ per_page: 1, mode: 'sequence', fit: 'fit', margin: 5, images: [{ document_id: primaryId, rot: 0 }] })
export const isDefaultSheet = (s, primaryId) =>
  s.per_page === 1 && s.fit === 'fit' && s.margin === 5 && s.images.length === 1
  && s.images[0].document_id === primaryId && s.images[0].rot === 0 && !isPlaced(s.images[0])
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
    for (const i of s.images) {
      if (i.crop !== undefined && i.crop !== null && (typeof i.crop !== 'object' || CROP_SIDES.some((k) => i.crop[k] !== undefined && !Number.isFinite(i.crop[k])))) throw new Error('Unsupported picture crop.')
      if (i.crop && (i.crop.l ?? 0) + (i.crop.r ?? 0) > CROP_MAX_TRIM + 1e-9 || i.crop && (i.crop.t ?? 0) + (i.crop.b ?? 0) > CROP_MAX_TRIM + 1e-9) throw new Error('That crop leaves too little of the picture.')
      for (const k of ['x', 'y', 'zoom']) if (i[k] !== undefined && !Number.isFinite(i[k])) throw new Error(k === 'zoom' ? 'Unsupported picture size.' : 'Unsupported picture position.')
    }
    if (sheetPageCount(s) > maxPages) throw new Error(`A print job is limited to ${maxPages} pages.`)
    return edits
  }
  if (edits.sheet) throw new Error('Image layouts only apply to images.')
  const pages = edits.pages ?? []
  if (!pages.length) throw new Error('Keep at least one page to print.')
  if (pages.length > maxPages) throw new Error(`A print job is limited to ${maxPages} pages.`)
  if (pages.some((p) => p.align !== undefined && !ALIGNS.includes(p.align))) throw new Error('Unsupported page position.')
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
