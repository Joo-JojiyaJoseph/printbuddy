import { ZOOM_MAX, ZOOM_MIN } from './pagePlan'

/** Shape (width / height) of what is shown of a picture: its natural size with the crop removed, after the customer's turn. */
export function shownAspect(natW, natH, crop, rot = 0) {
  const w = natW * (1 - (crop?.l ?? 0) - (crop?.r ?? 0)), h = natH * (1 - (crop?.t ?? 0) - (crop?.b ?? 0))
  return rot % 180 === 0 ? w / h : h / w
}

/** Size in px of a picture of shape `aspect` inside a cell: whole picture visible (`fit`) or covering it (`fill`). Same rule as the printer. */
export function fitBox(cellW, cellH, aspect, fit) {
  const s = (fit === 'fill' ? Math.max : Math.min)(cellW, cellH * aspect)
  return [s, s / aspect]
}

/**
 * Dragging a corner of a picture to resize it, the opposite corner staying where it is (like any photo editor).
 * Everything is in px measured from the middle of the cell. `size` is the picture's size now, `center` where it is now,
 * `corner` = [sx, sy] with -1 for left/top and +1 for right/bottom, `pointer` where the finger/mouse is.
 * Returns the new size factor (applied to the current zoom, limited so the zoom stays inside its range) and the new centre.
 */
export function cornerResize({ size: [w, h], center: [cx, cy], corner: [sx, sy], pointer: [px, py], zoom }) {
  const ax = cx - (sx * w) / 2, ay = cy - (sy * h) / 2 // the corner that stays put
  const vx = sx * w, vy = sy * h // from it to the dragged corner
  const along = ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy) // how far along that diagonal the pointer is
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * along))
  const k = next / zoom
  return { zoom: next, center: [ax + (sx * w * k) / 2, ay + (sy * h * k) / 2] }
}
