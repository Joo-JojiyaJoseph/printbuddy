import { useRef, useState } from 'react'
import Modal from './ui/Modal'
import { CellImage, useNaturalSize } from './SheetPaper'
import { cropFromDisplayed, cropToDisplayed } from '../utils/pagePlan'
import { shownAspect } from '../utils/placement'

const MIN_KEEP = 0.1 // at least a tenth of the picture stays on each axis
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ZERO = { l: 0, t: 0, r: 0, b: 0 }
// [name, left %, top %, cursor]: the four corners and the four edges of the frame
const HANDLES = [
  ['nw', 0, 0, 'nwse-resize'], ['n', 50, 0, 'ns-resize'], ['ne', 100, 0, 'nesw-resize'], ['e', 100, 50, 'ew-resize'],
  ['se', 100, 100, 'nwse-resize'], ['s', 50, 100, 'ns-resize'], ['sw', 0, 100, 'nesw-resize'], ['w', 0, 50, 'ew-resize'],
]

/**
 * Crop one picture: drag the corners or edges of the frame (or the frame itself) over the whole picture.
 * The picture is shown the way it sits on the sheet (turned if the customer turned it); the crop is handed back
 * on the upright picture, which is what is stored and printed.
 */
export default function CropModal({ doc, rot = 0, crop, onApply, onClose }) {
  const nat = useNaturalSize(doc.preview_url)
  const [c, setC] = useState(() => ({ ...ZERO, ...cropToDisplayed(crop, rot) }))
  const box = useRef(null)
  const drag = useRef(null)
  const aspect = nat ? shownAspect(nat.w, nat.h, null, rot) : null
  const changed = c.l > 0 || c.t > 0 || c.r > 0 || c.b > 0

  const frac = (e) => {
    const r = box.current.getBoundingClientRect()
    return r.width && r.height ? [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1), r] : null
  }
  const start = (e, handle) => {
    e.preventDefault(); e.stopPropagation()
    const f = frac(e)
    if (!f) return
    drag.current = { handle, fx: f[0], fy: f[1], c0: c }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* works without capture */ }
  }
  const move = (e) => {
    const g = drag.current, f = g && frac(e)
    if (!f) return
    const [fx, fy] = f
    const { l, t, r, b } = g.c0
    if (g.handle === 'frame') { // slide the frame without changing its size
      const w = 1 - l - r, h = 1 - t - b
      const nl = clamp(l + (fx - g.fx), 0, 1 - w), nt = clamp(t + (fy - g.fy), 0, 1 - h)
      setC({ l: nl, t: nt, r: 1 - w - nl, b: 1 - h - nt })
      return
    }
    const next = { ...g.c0 }
    if (g.handle.includes('w')) next.l = clamp(fx, 0, 1 - r - MIN_KEEP)
    if (g.handle.includes('e')) next.r = clamp(1 - fx, 0, 1 - l - MIN_KEEP)
    if (g.handle.includes('n')) next.t = clamp(fy, 0, 1 - b - MIN_KEEP)
    if (g.handle.includes('s')) next.b = clamp(1 - fy, 0, 1 - t - MIN_KEEP)
    setC(next)
  }
  const end = () => { drag.current = null }

  return (
    <Modal open onClose={onClose} title={`Crop ${doc.original_name}`} size="lg">
      <p className="m-0 mt-1 text-sm text-[var(--muted)]">Drag the corners or edges of the frame. Only what is inside the frame is printed.</p>
      {aspect ? (
        <div className="mx-auto mt-3" style={{ width: `min(100%, calc(60dvh * ${aspect}))` }}>
          <div ref={box} data-testid="crop-box" className="relative w-full select-none rounded-lg" style={{ aspectRatio: aspect }}>
            <div className="absolute inset-0 overflow-hidden rounded-lg bg-[#f4f4f8]" style={{ containerType: 'size' }}><CellImage url={doc.preview_url} name="" rot={rot} fit="fit" /></div>
            {/* the dimming is clipped to the picture; the frame and its handles are not, so the handles on the edge stay whole */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute" style={{ left: `${c.l * 100}%`, top: `${c.t * 100}%`, right: `${c.r * 100}%`, bottom: `${c.b * 100}%`, boxShadow: '0 0 0 100vmax rgba(16,36,43,.55)' }} />
            </div>
            <div role="presentation" data-testid="crop-frame" onPointerDown={(e) => start(e, 'frame')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
              className="absolute cursor-move touch-none outline outline-2 outline-white"
              style={{ left: `${c.l * 100}%`, top: `${c.t * 100}%`, right: `${c.r * 100}%`, bottom: `${c.b * 100}%` }}>
              {HANDLES.map(([name, x, y, cursor]) => (
                <span key={name} role="presentation" data-handle={name} onPointerDown={(e) => start(e, name)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                  style={{ left: `${x}%`, top: `${y}%`, cursor, touchAction: 'none' }} className="absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center">
                  <i className="block size-3.5 rounded-full border-2 border-white bg-accent shadow-[0_1px_4px_rgba(0,0,0,.5)]" />
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : <div className="mt-3 h-48 animate-pulse rounded-2xl bg-[var(--hi)]" role="status" aria-label="Loading picture" />}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setC(ZERO)} disabled={!changed} className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-bold disabled:opacity-40">Whole picture</button>
        <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-bold">Cancel</button>
        <button type="button" disabled={!aspect} onClick={() => onApply(cropFromDisplayed(c, rot))} className="min-h-12 flex-1 rounded-2xl bg-gradient-to-r from-accent-2 to-accent px-4 text-sm font-bold text-white disabled:opacity-40">Apply crop</button>
      </div>
    </Modal>
  )
}
