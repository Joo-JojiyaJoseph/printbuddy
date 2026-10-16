import { useEffect, useRef, useState } from 'react'
import { gridFor, paperMm, placeImage } from '../utils/pagePlan'
import { cornerResize, fitBox, shownAspect } from '../utils/placement'

/** Image rotated inside a cell. Quarter turns swap the box (container-query units) so the picture still fills it. */
export function CellImage({ url, name, rot, fit }) {
  const quarter = rot === 90 || rot === 270
  const common = { position: 'absolute', objectFit: fit === 'fill' ? 'cover' : 'contain' }
  const style = quarter
    ? { ...common, left: '50%', top: '50%', width: '100cqh', height: '100cqw', transform: `translate(-50%,-50%) rotate(${rot}deg)` }
    : { ...common, inset: 0, width: '100%', height: '100%', transform: rot ? `rotate(${rot}deg)` : undefined }
  return <img src={url} alt={name} style={style} draggable={false} />
}

// The picture's own size, learned once per picture (the crop and the corner handles need its shape).
const sizes = new Map()
export function useNaturalSize(url) {
  const [size, setSize] = useState(() => sizes.get(url) ?? null)
  useEffect(() => {
    if (!url) return undefined
    if (sizes.has(url)) { setSize(sizes.get(url)); return undefined }
    let off = false
    const img = new Image()
    img.onload = () => { if (img.naturalWidth) { const s = { w: img.naturalWidth, h: img.naturalHeight }; sizes.set(url, s); if (!off) setSize(s) } }
    img.src = url
    return () => { off = true; img.onload = null }
  }, [url])
  return size
}

const NUDGE = 0.02 // arrow key = 2% of the cell, Shift = 10%
const CORNERS = [[-1, -1, 'nwse-resize', 'top-left'], [1, -1, 'nesw-resize', 'top-right'], [-1, 1, 'nesw-resize', 'bottom-left'], [1, 1, 'nwse-resize', 'bottom-right']]

/** One picture in one cell: drawn cropped, moved and scaled; with `editable` it can be dragged and resized by its corners. */
function PicCell({ cell, d, fit, editable, on, onSelect, onPlace }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const nat = useNaturalSize(d?.preview_url)
  const p = cell ? placeImage(cell) : {}
  const zoom = p.zoom ?? 1
  const rot = cell?.rot ?? 0
  const quarter = rot === 90 || rot === 270
  const crop = p.crop
  const t = p.x || p.y || zoom !== 1 ? `translate(${(p.x ?? 0) * 100}%, ${(p.y ?? 0) * 100}%) scale(${zoom})` : undefined
  const m = fit === 'fill' ? 'max' : 'min' // 'fit': the whole picture shows; 'fill': it covers the cell

  // ----- drag the picture
  const down = (e) => {
    if (!editable || (e.button !== undefined && e.button > 0)) return
    onSelect?.(cell.document_id)
    const rect = ref.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    drag.current = { kind: 'move', sx: e.clientX, sy: e.clientY, x0: p.x ?? 0, y0: p.y ?? 0, w: rect.width, h: rect.height }
    try { ref.current.setPointerCapture?.(e.pointerId) } catch { /* the drag still works without capture */ }
  }
  const move = (e) => {
    const g = drag.current
    if (!g || g.kind !== 'move') return
    onPlace?.(cell.document_id, { x: g.x0 + (e.clientX - g.sx) / g.w, y: g.y0 + (e.clientY - g.sy) / g.h })
  }
  const up = () => { drag.current = null }
  const key = (e) => {
    if (!editable) return
    const step = e.shiftKey ? NUDGE * 5 : NUDGE
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!by) return
    e.preventDefault()
    onSelect?.(cell.document_id)
    onPlace?.(cell.document_id, { x: (p.x ?? 0) + by[0], y: (p.y ?? 0) + by[1] })
  }

  // ----- drag a corner to make the picture bigger or smaller (the opposite corner stays where it is)
  const aspect = nat ? shownAspect(nat.w, nat.h, crop, rot) : null
  const cornerDown = (e, corner) => {
    e.stopPropagation()
    const rect = ref.current.getBoundingClientRect()
    if (!rect.width || !rect.height || !aspect) return
    const [bw, bh] = fitBox(rect.width, rect.height, aspect, fit)
    drag.current = { kind: 'corner', corner, rect, size: [bw * zoom, bh * zoom], center: [(p.x ?? 0) * rect.width, (p.y ?? 0) * rect.height], zoom }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* works without capture */ }
  }
  const cornerMove = (e) => {
    const g = drag.current
    if (!g || g.kind !== 'corner') return
    const r = cornerResize({ size: g.size, center: g.center, corner: g.corner, zoom: g.zoom,
      pointer: [e.clientX - (g.rect.left + g.rect.width / 2), e.clientY - (g.rect.top + g.rect.height / 2)] })
    onPlace?.(cell.document_id, { zoom: r.zoom, x: r.center[0] / g.rect.width, y: r.center[1] / g.rect.height })
  }

  let body = null
  if (d?.preview_url && nat) {
    const l = crop?.l ?? 0, tp = crop?.t ?? 0
    const kw = 1 - l - (crop?.r ?? 0), kh = 1 - tp - (crop?.b ?? 0)
    const ar0 = (nat.w * kw) / (nat.h * kh) // shape of the kept part before it is turned
    const a = quarter ? 1 / ar0 : ar0 // and as shown
    const frameW = quarter ? `${m}(calc(${ar0} * 100cqw), 100cqh)` : `${m}(100cqw, calc(${ar0} * 100cqh))`
    const shownW = `${m}(100cqw, calc(${a} * 100cqh))`
    body = (
      <div style={{ position: 'absolute', inset: 0, transform: t }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: frameW, aspectRatio: ar0, overflow: 'hidden', transform: `translate(-50%,-50%)${rot ? ` rotate(${rot}deg)` : ''}` }}>
          <img src={d.preview_url} alt={editable ? '' : d.original_name} draggable={false}
            style={{ position: 'absolute', width: `${100 / kw}%`, height: `${100 / kh}%`, left: `${(-l / kw) * 100}%`, top: `${(-tp / kh) * 100}%`, maxWidth: 'none' }} />
        </div>
        {editable && on && (
          <div data-testid="resize-box" style={{ position: 'absolute', left: '50%', top: '50%', width: shownW, aspectRatio: a, transform: 'translate(-50%,-50%)' }}
            className="pointer-events-none outline outline-[1.5px] outline-dashed outline-accent">
            {CORNERS.map(([sx, sy, cursor, name]) => (
              <span key={name} role="presentation" data-corner={name}
                onPointerDown={(e) => cornerDown(e, [sx, sy])} onPointerMove={cornerMove} onPointerUp={up} onPointerCancel={up}
                // just INSIDE the corner: a handle centred on it would be half cut off wherever the picture reaches the edge of its cell
                style={{ [sx < 0 ? 'left' : 'right']: 0, [sy < 0 ? 'top' : 'bottom']: 0, transformOrigin: `${sx < 0 ? '0%' : '100%'} ${sy < 0 ? '0%' : '100%'}`, transform: `scale(${1 / zoom})`, cursor, touchAction: 'none' }}
                className="pointer-events-auto absolute grid size-9 place-items-center">
                <i className="block size-3.5 rounded-full border-2 border-white bg-accent shadow-[0_1px_4px_rgba(0,0,0,.5)]" />
              </span>
            ))}
          </div>
        )}
      </div>
    )
  } else if (d?.preview_url) {
    body = <div style={{ position: 'absolute', inset: 0, transform: t }}><CellImage url={d.preview_url} name={editable ? '' : d.original_name} rot={rot} fit={fit} /></div>
  }

  return (
    <div ref={ref} className={`relative overflow-hidden bg-[#f4f4f8] ${editable && d ? 'cursor-grab touch-none select-none active:cursor-grabbing focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-accent' : ''} ${on ? 'ring-2 ring-inset ring-accent' : ''}`}
      style={{ containerType: 'size' }}
      {...(editable && d ? {
        role: 'button', tabIndex: 0, 'aria-label': `Place ${d.original_name}. Drag it, or use the arrow keys.`, 'data-cell': cell.document_id,
        onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onKeyDown: key, onFocus: () => onSelect?.(cell.document_id),
      } : {})}>
      {body}
    </div>
  )
}

/**
 * One printed sheet laid out with `perPage` images, using the chosen margin, sizing and orientation.
 * With `editable`, each picture can be dragged (mouse, finger or arrow keys) to where it should print, and its corners
 * dragged to resize it. A picture's `x`/`y` are fractions of its cell measured from the middle, `zoom` is its size and
 * `crop` the sides trimmed away: the same numbers the server prints with.
 */
export default function SheetPaper({ cells, docsById, perPage, fit, margin, size, orientation, grayscale = false, label, editable = false, selectedId = null, onSelect, onPlace }) {
  const landscape = orientation === 'landscape'
  const [cols, rows] = gridFor(perPage, landscape)
  const [w, h] = paperMm(size, orientation)
  const pad = `${(margin / w) * 100}%`
  return (
    <div role="img" aria-label={label}
      style={{ aspectRatio: w / h, padding: pad, filter: grayscale ? 'grayscale(1)' : undefined }}
      className="relative w-full overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: pad }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const cell = cells[i]
          const d = cell && docsById[cell.document_id]
          return <PicCell key={i} cell={cell} d={d} fit={fit} editable={editable} on={editable && !!d && cell.document_id === selectedId} onSelect={onSelect} onPlace={onPlace} />
        })}
      </div>
    </div>
  )
}
