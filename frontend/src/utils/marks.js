// Edit-in-place marks drawn ON TOP of a PDF page (the original page, its fonts and layout are never touched):
//   text  - typed (or re-typed) text, optionally on a white patch that covers what was there
//   cover - white-out (or any colour) rectangle
//   hl    - see-through highlighter
// Positions are fractions (0-1) of the displayed page; text size `fs` is a fraction of the page height.
// The backend PagePlan validates the same shapes and is the authority; this file only drives the editor.

export const MARK_COLORS = ['#000000', '#d11a2a', '#1556c0', '#1b8a3a', '#6b3fa0']
export const HL_COLORS = ['#ffe600', '#7dff7a', '#ff9ad5', '#7ad7ff']
export const MAX_MARKS = 60
const MIN = 0.01

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round = (v) => Math.round(v * 10000) / 10000

/** Keep a rectangle fully inside the page and at least MIN wide/high. */
export function clampRect({ x, y, w, h }) {
  const W = clamp(w, MIN, 1), H = clamp(h, MIN, 1)
  return { x: round(clamp(x, 0, 1 - W)), y: round(clamp(y, 0, 1 - H)), w: round(W), h: round(H) }
}

export function newMark(type, rect, extra = {}) {
  const r = clampRect(rect)
  if (type === 'text') return { t: 'text', ...r, text: '', fs: 0.022, color: '#000000', bold: false, align: 'l', cover: false, ...extra }
  if (type === 'hl') return { t: 'hl', ...r, color: '#ffe600', ...extra }
  return { t: 'cover', ...r, color: '#ffffff', ...extra }
}

/** Rectangle from two drag points; a tiny drag (a tap) becomes the default size for the tool. */
export function rectFromDrag(a, b, type) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  const w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y)
  if (w < 0.02 && h < 0.015) {
    const dw = type === 'text' ? 0.34 : 0.25, dh = type === 'text' ? 0.05 : 0.035
    return clampRect({ x: a.x - dw / 2, y: a.y - dh / 2, w: dw, h: dh })
  }
  return clampRect({ x, y, w, h })
}

export const moveMark = (m, dx, dy) => ({ ...m, ...clampRect({ x: m.x + dx, y: m.y + dy, w: m.w, h: m.h }) })
export const resizeMark = (m, dw, dh) => ({ ...m, ...clampRect({ x: m.x, y: m.y, w: m.w + dw, h: m.h + dh }) })

/**
 * A mark after its page is turned a quarter clockwise (dir > 0) or anticlockwise. `aspect` = displayed page
 * width / height BEFORE the turn; it keeps the physical text size right because `fs` is relative to page height.
 */
export function rotateMark(m, dir, aspect = 0.707) {
  const r = dir > 0 ? { x: 1 - (m.y + m.h), y: m.x, w: m.h, h: m.w } : { x: m.y, y: 1 - (m.x + m.w), w: m.h, h: m.w }
  const out = { ...m, ...clampRect(r) }
  if (m.t === 'text') out.fs = round(clamp(m.fs / (aspect || 1), 0.006, 0.15))
  return out
}

/**
 * A text item from PDF.js (viewport coordinates, px) -> a text mark that covers the original words and re-types them,
 * so the customer can change existing text without the page layout moving.
 */
export function markFromTextItem(item, view) {
  const pad = Math.max(1, item.height * 0.12)
  const rect = { x: (item.left - pad) / view.width, y: (item.top - pad * 0.5) / view.height, w: (item.width + pad * 2) / view.width, h: (item.height + pad) / view.height }
  return newMark('text', rect, { text: item.str, fs: clamp(item.height / view.height, 0.008, 0.12), cover: true })
}

/** Where the picture of a page lands on the printed sheet, as fractions of the sheet (marks live inside this rectangle). */
export function pictureRect(align, sheetRatio, pageAspect, { paperMm, pageMm } = {}) {
  const R = sheetRatio                                  // sheet width / height; sheet height = 1
  const boxes = { fit: [0.04, 0.04, 0.92, 0.92, 'contain'], edge: [0, 0, 1, 1, 'contain'], fill: [0, 0, 1, 1, 'cover'],
    center: [0.125, 0.125, 0.75, 0.75, 'contain'], tl: [0, 0, 0.75, 0.75, 'contain'] }
  if (align === 'actual' && paperMm && pageMm) {
    const w = pageMm[0] / paperMm[0], h = pageMm[1] / paperMm[1]
    return { left: 0.5 - w / 2, top: 0.5 - h / 2, width: w, height: h }
  }
  const [bx, by, bw, bh, mode] = boxes[align] ?? boxes.fit
  const boxW = bw * R, boxH = bh                         // in sheet-height units
  const boxAspect = boxW / boxH
  const useWidth = mode === 'cover' ? boxAspect < pageAspect : boxAspect > pageAspect
  const h = useWidth ? boxH : boxW / pageAspect
  const w = useWidth ? boxH * pageAspect : boxW
  const left = (bx * R + (boxW - w) / 2) / R
  const top = by + (boxH - h) / 2
  return { left, top, width: w / R, height: h }
}

export const stampActive = (s) => !!s && (!!s.numbers || !!s.watermark?.trim())
