import { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, Eraser, Highlighter, MousePointer2, ScanText, Trash2, Type } from 'lucide-react'
import PdfCanvas from './PdfCanvas'
import { markStyle } from './MarksLayer'
import { loadPdfjs } from '../utils/pdf'
import { HL_COLORS, MARK_COLORS, MAX_MARKS, markFromTextItem, moveMark, newMark, rectFromDrag, resizeMark } from '../utils/marks'

const TOOLS = [
  ['move', 'Move', MousePointer2], ['edit', 'Change existing text', ScanText], ['text', 'Add text', Type], ['cover', 'Erase', Eraser], ['hl', 'Highlight', Highlighter],
]
const chip = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-[0.8125rem] font-bold'
const COVER_COLORS = ['#ffffff', '#000000', '#d11a2a', '#1556c0']

/**
 * Edit a PDF page IN PLACE: the original page stays exactly as it is, and the customer adds text, white-out and highlights
 * on top of it. Existing words can be clicked to change them: they are covered and re-typed in the same spot and size.
 */
export default function AnnotateView({ pdf, src, rot, marks, onChange }) {
  const [tool, setTool] = useState('move')
  const [sel, setSel] = useState(null)
  const [drag, setDrag] = useState(null)      // {kind:'new'|'move'|'resize', start, current, index, original}
  const [view, setView] = useState(null)      // displayed page size in PDF px at scale 1
  const [items, setItems] = useState([])
  const layerRef = useRef(null)
  const draft = drag?.draft
  const shown = useMemo(() => (draft ? marks.map((m, i) => (i === drag.index ? draft : m)) : marks), [marks, draft, drag])

  // Page size and the clickable words of the page.
  useEffect(() => {
    if (!pdf || !src) return undefined
    let off = false
    ;(async () => {
      const [page, pdfjs] = await Promise.all([pdf.getPage(src), loadPdfjs()])
      const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rot) % 360 })
      const content = await page.getTextContent()
      if (off) return
      setView({ width: vp.width, height: vp.height })
      const out = []
      for (const it of content.items) {
        if (!it.str || !it.str.trim()) continue
        const t = pdfjs.Util.transform(vp.transform, it.transform)
        if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) continue // only horizontal text can be re-typed in place
        const height = Math.hypot(t[2], t[3])
        out.push({ str: it.str, left: t[4], top: t[5] - height * 0.95, width: it.width * vp.scale, height: height * 1.1 })
      }
      setItems(out)
    })().catch(() => { if (!off) setItems([]) })
    return () => { off = true }
  }, [pdf, src, rot])
  useEffect(() => { setSel(null); setDrag(null) }, [src, rot])

  const point = (e) => {
    const r = layerRef.current.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const full = marks.length >= MAX_MARKS
  const replace = (i, m, quiet = false) => onChange(marks.map((x, j) => (j === i ? m : x)), 'Mark changed', { quiet })
  const add = (m, note) => { onChange([...marks, m], note); setSel(marks.length); setTool('move') }

  const down = (e) => {
    if (e.target !== layerRef.current || tool === 'move' || tool === 'edit' || full) { if (e.target === layerRef.current) setSel(null); return }
    layerRef.current.setPointerCapture?.(e.pointerId)
    const p = point(e)
    setDrag({ kind: 'new', start: p, current: p })
  }
  const move = (e) => {
    if (!drag) return
    const p = point(e)
    if (drag.kind === 'new') setDrag({ ...drag, current: p })
    else {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y
      setDrag({ ...drag, draft: drag.kind === 'move' ? moveMark(drag.original, dx, dy) : resizeMark(drag.original, dx, dy) })
    }
  }
  const up = () => {
    if (!drag) return
    if (drag.kind === 'new') {
      const r = rectFromDrag(drag.start, drag.current, tool)
      add(newMark(tool, r, tool === 'text' ? { text: 'Text' } : {}), tool === 'text' ? 'Text box added' : tool === 'cover' ? 'Erase area added' : 'Highlight added')
    } else if (drag.draft) replace(drag.index, drag.draft)
    setDrag(null)
  }
  const startMark = (e, i, kind) => {
    if (tool !== 'move') return
    e.stopPropagation()
    layerRef.current.setPointerCapture?.(e.pointerId)
    setSel(i)
    setDrag({ kind, start: point(e), current: point(e), index: i, original: marks[i] })
  }
  const nudge = (e, i) => {
    const d = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key]
    if (d) { e.preventDefault(); replace(i, moveMark(marks[i], d[0], d[1])) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(i) }
  }
  const remove = (i) => { onChange(marks.filter((_, j) => j !== i), 'Mark removed'); setSel(null) }
  const pick = (it) => { if (!full && view) add(markFromTextItem(it, view), 'Text ready to change') }

  const m = sel != null ? shown[sel] : null
  const ghost = drag?.kind === 'new' ? rectFromDrag(drag.start, drag.current, tool) : null
  const cursor = tool === 'move' ? 'default' : 'crosshair'

  return (
    <div>
      <div role="toolbar" aria-label="Edit on the page" className="mb-2 flex flex-wrap gap-1.5">
        {TOOLS.map(([id, label, Icon]) => (
          <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)}
            className={`${chip} ${tool === id ? 'border-accent bg-accent/15' : 'border-[var(--border)] bg-[var(--card)]'}`}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      <p role="status" className="mb-2 mt-0 text-xs text-[var(--muted)]">
        {full ? `You reached ${MAX_MARKS} marks on this page.`
          : tool === 'edit' ? (items.length ? 'Tap a word or line to change it. The page design stays exactly as it is.' : 'This page has no selectable text (it may be a scan). Use Erase and Add text instead.')
          : tool === 'text' ? 'Tap (or drag a box) where the text should go.' : tool === 'cover' ? 'Drag over what you want to hide.' : tool === 'hl' ? 'Drag over what you want to highlight.'
          : 'Tap a mark to select, drag to move, use the corner to resize.'}
      </p>

      <div className="relative mx-auto w-full max-w-[32.5rem] overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)]" style={{ aspectRatio: view ? view.width / view.height : 0.707 }}>
        <PdfCanvas pdf={pdf} page={src} rotation={rot} width={720} className="h-full w-full" label="Page to edit" />
        <div ref={layerRef} data-testid="annotate-layer" className="absolute inset-0 touch-none select-none" style={{ containerType: 'size', cursor }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
          {tool === 'edit' && view && items.map((it, i) => (
            <button key={i} type="button" aria-label={`Change “${it.str}”`} onClick={() => pick(it)}
              className="absolute rounded-sm border border-accent/60 bg-accent/10 hover:bg-accent/30"
              style={{ left: `${(it.left / view.width) * 100}%`, top: `${(it.top / view.height) * 100}%`, width: `${(it.width / view.width) * 100}%`, height: `${(it.height / view.height) * 100}%` }} />
          ))}
          {shown.map((mk, i) => (
            <div key={i} role="button" tabIndex={0} aria-label={`${mk.t === 'text' ? 'Text' : mk.t === 'cover' ? 'Erase area' : 'Highlight'} ${i + 1}`}
              onPointerDown={(e) => startMark(e, i, 'move')} onKeyDown={(e) => nudge(e, i)} onFocus={() => setSel(i)}
              style={{ ...markStyle(mk), outline: sel === i ? '2px solid #5CC0C7' : mk.t === 'text' && !mk.cover ? '1px dashed rgba(14,124,134,.7)' : 'none', cursor: tool === 'move' ? 'move' : 'inherit', pointerEvents: tool === 'move' ? 'auto' : 'none',
                ...(mk.t === 'cover' && tool === 'move' ? { opacity: 0.92 } : null) }}>
              {mk.t === 'text' ? mk.text : null}
              {sel === i && tool === 'move' && (
                <span onPointerDown={(e) => startMark(e, i, 'resize')} aria-hidden="true"
                  className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-full border-2 border-white bg-accent" />
              )}
            </div>
          ))}
          {ghost && <div style={{ ...markStyle(newMark(tool, ghost)), outline: '2px dashed #5CC0C7', opacity: 0.6 }} />}
        </div>
      </div>

      {m && (
        <div className="mx-auto mt-3 max-w-[32.5rem] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3" aria-label="Selected mark">
          {m.t === 'text' && (<>
            <label htmlFor="mark-text" className="mb-1 block text-xs font-bold">Text</label>
            <textarea id="mark-text" rows={2} maxLength={400} value={m.text} onChange={(e) => replace(sel, { ...marks[sel], text: e.target.value }, true)}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent p-2 text-base" />
            <div className="mt-2 flex items-center gap-3">
              <label htmlFor="mark-size" className="text-xs font-bold">Size</label>
              <input id="mark-size" type="range" min="0.008" max="0.12" step="0.002" value={m.fs} onChange={(e) => replace(sel, { ...marks[sel], fs: Number(e.target.value) }, true)} className="h-8 flex-1 accent-[var(--color-accent)]" />
              <button type="button" aria-label="Bold" aria-pressed={m.bold} onClick={() => replace(sel, { ...marks[sel], bold: !m.bold })}
                className={`grid size-11 place-items-center rounded-xl border ${m.bold ? 'border-accent bg-accent/15' : 'border-[var(--border)]'}`}><Bold size={16} aria-hidden="true" /></button>
            </div>
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={m.cover} onChange={(e) => replace(sel, { ...marks[sel], cover: e.target.checked })} className="size-5 accent-[var(--color-accent)]" />
              Cover what is under this box (white background)
            </label>
          </>)}
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Colour">
            <span className="text-xs font-bold">Colour</span>
            {(m.t === 'text' ? MARK_COLORS : m.t === 'hl' ? HL_COLORS : COVER_COLORS).map((c) => (
              <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={m.color === c} onClick={() => replace(sel, { ...marks[sel], color: c })}
                className={`size-9 rounded-full border-2 ${m.color === c ? 'border-accent' : 'border-[var(--border)]'}`} style={{ background: c }} />
            ))}
            <button type="button" onClick={() => remove(sel)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-bold text-danger"><Trash2 size={16} aria-hidden="true" />Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}
