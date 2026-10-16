import { useState } from 'react'
import { ArrowLeft, ArrowRight, Copy, FilePlus, PenLine, Plus, Redo2, RotateCcw, RotateCw, Trash2, Type, Undo2 } from 'lucide-react'
import AnnotateView from './AnnotateView'
import PageSheet from './PageSheet'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useBlankPages } from '../hooks/useBlankPages'
import {
  ALIGN_OPTIONS, addBlank, commit, duplicatePage, fromPageEdits, isIdentity, movePage, newHistory, redo, removePage,
  rotatePage, setAlign, setAlignAll, setMarks, toPageEdits, undo, identityPlan,
} from '../utils/pagePlan'
import { stampActive } from '../utils/marks'

const tool = 'grid min-h-[4.25rem] place-items-center rounded-[18px] border border-[var(--border)] bg-white px-0.5 py-1.5 text-[0.8125rem] shadow-sm font-bold transition-transform active:scale-95 disabled:opacity-30'
const summary = 'flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-bold [&::-webkit-details-marker]:hidden'
const heading = 'mb-2 mt-4 text-sm font-bold'

/** Page-level editing for PDF, Word and text documents: rotate, copy, reorder, add blank, remove, position. */
export default function PageEditor({ doc, edits, onEdits, ratio, paperMm, onEditText }) {
  const n = doc.page_count
  const { pdf, error } = usePdfDocument(doc.preview_url)
  const blank = useBlankPages(pdf, n)
  const [h, setH] = useState(() => newHistory(fromPageEdits(edits, n)))
  const [sel, setSel] = useState(0)
  const [note, setNote] = useState('')
  const [annotate, setAnnotate] = useState(false)
  const [stamp, setStamp] = useState(() => edits?.stamp ?? { numbers: false, watermark: '' })
  const plan = h.present
  const cur = Math.min(sel, plan.length - 1)
  const page = plan[cur]

  const publish = (next, st = stamp) => onEdits(toPageEdits(next, n, st))
  const changeStamp = (patch) => { const st = { ...stamp, ...patch }; setStamp(st); publish(plan, st) }
  // Typing and slider moves update the page without adding an undo step per keystroke.
  const onMarks = (marks, message, { quiet = false } = {}) => {
    const next = setMarks(plan, cur, marks)
    if (quiet) { setH({ ...h, present: next }); publish(next) } else apply(() => next, message)
  }
  const apply = (fn, message, nextSel) => {
    const next = fn(plan)
    if (next === plan) return
    setH(commit(h, next)); publish(next); setNote(message)
    if (nextSel !== undefined) setSel(Math.max(0, Math.min(nextSel, next.length - 1)))
  }
  const doUndo = () => { const u = undo(h); setH(u); publish(u.present); setNote('Undone'); setSel((s) => Math.min(s, u.present.length - 1)) }
  const doRedo = () => { const r = redo(h); setH(r); publish(r.present); setNote('Redone') }
  const reset = () => { const p = identityPlan(n); const st = { numbers: false, watermark: '' }; setH(commit(h, p)); setStamp(st); publish(p, st); setNote('All edits cleared'); setSel(0); setAnnotate(false) }

  const emptyIdx = plan.findIndex((p) => p.src !== null && blank.has(p.src))
  const label = (i) => `Page ${i + 1}${plan[i].src === null ? ' (blank)' : ''}`

  return (
    <div className="mx-auto max-w-3xl md:grid md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:gap-10">
      <div className="min-w-0 md:sticky md:top-4">
      {annotate && page.src !== null ? (
        <AnnotateView pdf={pdf} src={page.src} rot={page.rot} marks={page.marks ?? []} onChange={onMarks} />
      ) : (
        <div className="mx-auto w-[64%] max-w-[23.75rem] py-1 md:w-[90%]">
          <PageSheet pdf={pdf} item={page} ratio={ratio} paperMm={paperMm} renderWidth={520} label={`${label(cur)} preview`} number={cur + 1} total={plan.length} stamp={stampActive(stamp) ? stamp : null} />
        </div>
      )}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      <p className="m-0 text-center text-[0.8125rem] font-bold text-[var(--muted)]">
        Page {cur + 1} of {plan.length}{page.src !== null && page.src !== cur + 1 ? ` · original page ${page.src}` : ''}
      </p>

      <div role="listbox" aria-label="Pages" className="flex gap-2 overflow-x-auto px-0.5 pb-1.5 pt-3 [scrollbar-width:none]">
        {plan.map((p, i) => (
          <button key={i} type="button" role="option" aria-selected={i === cur} aria-label={label(i)} onClick={() => setSel(i)}
            className={`w-[3.375rem] flex-none rounded-[10px] border-2 p-0.5 text-center text-xs text-[var(--muted)] transition-all ${i === cur ? '-translate-y-1 border-accent bg-[var(--card)] shadow-[0_8px_18px_rgba(14,124,134,.3)]' : 'border-transparent'}`}>
            <PageSheet pdf={pdf} item={p} ratio={ratio} renderWidth={110} lazy label="" />
            {i + 1}
          </button>
        ))}
        <button type="button" aria-label="Add blank page after this one" onClick={() => apply((pl) => addBlank(pl, cur), 'Blank page added', cur + 1)}
          className="grid min-h-[4.5rem] w-[3.375rem] flex-none place-items-center rounded-[10px] text-accent"><Plus aria-hidden="true" /></button>
      </div>

      {emptyIdx > -1 && (
        <div role="status" className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-amber/40 bg-amber/15 px-3 py-2 text-sm text-amber">
          <span>Page {emptyIdx + 1} looks empty</span>
          <button type="button" onClick={() => apply((pl) => removePage(pl, emptyIdx), `Page ${emptyIdx + 1} removed`, emptyIdx)}
            className="min-h-9 rounded-xl bg-amber px-3 font-bold text-white">Remove</button>
        </div>
      )}

      </div>
      <div className="min-w-0">
      <div className="mt-3 flex items-center justify-between gap-2 text-sm md:mt-0" aria-live="polite" role="status">
        <span className="font-bold text-[var(--muted)]">{note || `${plan.length} page${plan.length === 1 ? '' : 's'} will print`}</span>
        <span className="flex gap-1.5">
          <button type="button" aria-label="Undo" disabled={!h.past.length} onClick={doUndo} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Undo2 size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Redo" disabled={!h.future.length} onClick={doRedo} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Redo2 size={18} aria-hidden="true" /></button>
        </span>
      </div>

      <h3 className={heading}>This page</h3>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <button type="button" className={tool} onClick={() => apply((pl) => rotatePage(pl, cur, -1), `Page ${cur + 1} rotated left`)}><RotateCcw aria-hidden="true" />Rotate left</button>
        <button type="button" className={tool} onClick={() => apply((pl) => rotatePage(pl, cur, 1), `Page ${cur + 1} rotated right`)}><RotateCw aria-hidden="true" />Rotate right</button>
        <button type="button" className={`${tool} text-danger`} disabled={plan.length <= 1} onClick={() => apply((pl) => removePage(pl, cur), `Page ${cur + 1} removed`, cur)}><Trash2 aria-hidden="true" />Remove</button>
        <button type="button" className={`${tool} ${annotate ? 'border-accent bg-[#e3f3f3]' : ''}`} aria-pressed={annotate} disabled={page.src === null} onClick={() => setAnnotate((v) => !v)}><PenLine aria-hidden="true" />{annotate ? 'Done editing' : 'Edit on page'}</button>
        {doc.can_edit_text && doc.kind !== 'pdf' && <button type="button" className={`${tool} col-span-2 lg:col-span-4`} onClick={onEditText}><Type aria-hidden="true" />Edit text</button>}
      </div>
      <p className="m-0 mt-1.5 text-xs text-[var(--muted)]">“Edit on page” lets you type, white-out or highlight on top of your page. The original design is kept.</p>

      <details className="group mt-3 rounded-2xl border border-[var(--border)] bg-white">
        <summary className={summary}>More page tools <span className="text-xs font-semibold text-[var(--muted)]">copy, add blank, reorder</span></summary>
        <div className="grid grid-cols-2 gap-2 px-3 pb-3 lg:grid-cols-4">
          <button type="button" className={tool} onClick={() => apply((pl) => duplicatePage(pl, cur), `Page ${cur + 1} copied`, cur + 1)}><Copy aria-hidden="true" />Copy page</button>
          <button type="button" className={tool} onClick={() => apply((pl) => addBlank(pl, cur), 'Blank page added', cur + 1)}><FilePlus aria-hidden="true" />Add blank</button>
          <button type="button" className={tool} disabled={cur === 0} onClick={() => apply((pl) => movePage(pl, cur, -1), `Page ${cur + 1} moved earlier`, cur - 1)}><ArrowLeft aria-hidden="true" />Move earlier</button>
          <button type="button" className={tool} disabled={cur >= plan.length - 1} onClick={() => apply((pl) => movePage(pl, cur, 1), `Page ${cur + 1} moved later`, cur + 1)}><ArrowRight aria-hidden="true" />Move later</button>
        </div>
      </details>

      <details className="group mt-2 rounded-2xl border border-[var(--border)] bg-white" open={stampActive(stamp)}>
        <summary className={summary}>Page numbers &amp; watermark <span className="text-xs font-semibold text-[var(--muted)]">optional</span></summary>
        <div className="space-y-2 px-3 pb-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={stamp.numbers} onChange={(e) => changeStamp({ numbers: e.target.checked })} className="size-5 accent-[var(--color-accent)]" />
            Page numbers (1 / {plan.length})
          </label>
          <div>
            <label htmlFor="watermark" className="mb-1 block text-sm font-bold">Watermark</label>
            <input id="watermark" type="text" maxLength={40} value={stamp.watermark} placeholder="e.g. CONFIDENTIAL" onChange={(e) => changeStamp({ watermark: e.target.value })}
              className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-base" />
          </div>
        </div>
      </details>

      <details className="group mt-2 rounded-2xl border border-[var(--border)] bg-white">
        <summary className={summary}>Position on paper <span className="text-xs font-semibold text-[var(--muted)]">{ALIGN_OPTIONS.find((o) => o.value === page.align)?.label}</span></summary>
        <div className="px-3 pb-3">
          <div role="radiogroup" aria-label="Position on paper" className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
            {ALIGN_OPTIONS.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={page.align === o.value}
                onClick={() => apply((pl) => setAlign(pl, cur, o.value), `Page ${cur + 1}: ${o.label}`)}
                className={`min-h-[2.875rem] rounded-[14px] border-[1.5px] px-1 text-xs font-bold ${page.align === o.value ? 'border-accent bg-[#e3f3f3]' : 'border-[var(--border)] bg-white'}`}>{o.label}</button>
            ))}
          </div>
          <button type="button" onClick={() => apply((pl) => setAlignAll(pl, page.align), `${ALIGN_OPTIONS.find((o) => o.value === page.align).label} applied to all pages`)}
            className="mt-2 min-h-10 text-sm font-bold text-accent">Apply to all pages</button>
        </div>
      </details>
      {!isIdentity(plan, n) && <button type="button" onClick={reset} className="mt-2 min-h-10 text-sm font-bold text-[var(--muted)] underline">Reset edits</button>}
      {plan.some((p) => p.src === null) && <p className="m-0 mt-1 text-xs text-[var(--muted)]">Blank pages you add are printed and charged like any other page.</p>}
      </div>
    </div>
  )
}
