import { useRef } from 'react'
import { gridFor, paperMm, placeImage } from '../utils/pagePlan'

/** Image rotated inside a cell. Quarter turns swap the box (container-query units) so the picture still fills it. */
function CellImage({ url, name, rot, fit }) {
  const quarter = rot === 90 || rot === 270
  const common = { position: 'absolute', objectFit: fit === 'fill' ? 'cover' : 'contain' }
  const style = quarter
    ? { ...common, left: '50%', top: '50%', width: '100cqh', height: '100cqw', transform: `translate(-50%,-50%) rotate(${rot}deg)` }
    : { ...common, inset: 0, width: '100%', height: '100%', transform: rot ? `rotate(${rot}deg)` : undefined }
  return <img src={url} alt={name} style={style} draggable={false} />
}

const NUDGE = 0.02 // arrow key = 2% of the cell, Shift = 10%

/**
 * One printed sheet laid out with `perPage` images, using the chosen margin, sizing and orientation.
 * With `editable`, each picture can be dragged (mouse, finger or arrow keys) to where it should print. A picture's
 * `x`/`y` are fractions of its cell measured from the middle, `zoom` is its size: the same numbers the server prints with.
 */
export default function SheetPaper({ cells, docsById, perPage, fit, margin, size, orientation, grayscale = false, label, editable = false, selectedId = null, onSelect, onPlace }) {
  const landscape = orientation === 'landscape'
  const [cols, rows] = gridFor(perPage, landscape)
  const [w, h] = paperMm(size, orientation)
  const pad = `${(margin / w) * 100}%`
  const drag = useRef(null)

  const down = (e, cell) => {
    if (!editable || (e.button !== undefined && e.button > 0)) return
    onSelect?.(cell.document_id)
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    drag.current = { id: cell.document_id, sx: e.clientX, sy: e.clientY, x0: cell.x ?? 0, y0: cell.y ?? 0, w: rect.width, h: rect.height }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* the drag still works without capture */ }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    onPlace?.(d.id, { x: d.x0 + (e.clientX - d.sx) / d.w, y: d.y0 + (e.clientY - d.sy) / d.h })
  }
  const up = () => { drag.current = null }
  const key = (e, cell) => {
    if (!editable) return
    const step = e.shiftKey ? NUDGE * 5 : NUDGE
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!by) return
    e.preventDefault()
    onSelect?.(cell.document_id)
    onPlace?.(cell.document_id, { x: (cell.x ?? 0) + by[0], y: (cell.y ?? 0) + by[1] })
  }

  return (
    <div role="img" aria-label={label}
      style={{ aspectRatio: w / h, padding: pad, filter: grayscale ? 'grayscale(1)' : undefined }}
      className="relative w-full overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: pad }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const cell = cells[i]
          const d = cell && docsById[cell.document_id]
          const on = editable && d && cell.document_id === selectedId
          const p = cell ? placeImage(cell) : {}
          const t = p.x || p.y || (p.zoom && p.zoom !== 1)
            ? `translate(${(p.x ?? 0) * 100}%, ${(p.y ?? 0) * 100}%) scale(${p.zoom ?? 1})` : undefined
          return (
            <div key={i} className={`relative overflow-hidden bg-[#f4f4f8] ${editable && d ? 'cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-accent' : ''} ${on ? 'ring-2 ring-inset ring-accent' : ''}`}
              style={{ containerType: 'size' }}
              {...(editable && d ? {
                role: 'button', tabIndex: 0, 'aria-label': `Place ${d.original_name}. Drag it, or use the arrow keys.`, 'data-cell': cell.document_id,
                onPointerDown: (e) => down(e, cell), onPointerMove: move, onPointerUp: up, onPointerCancel: up, onKeyDown: (e) => key(e, cell), onFocus: () => onSelect?.(cell.document_id),
              } : {})}>
              {d?.preview_url && (
                <div style={{ position: 'absolute', inset: 0, transform: t }}>
                  <CellImage url={d.preview_url} name={editable ? '' : d.original_name} rot={cell.rot} fit={fit} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
