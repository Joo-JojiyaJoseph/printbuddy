import { ArrowLeft, ArrowRight, Redo2, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'
import PageSheet from './PageSheet'
import { movePage, removePage, rotatePage } from '../utils/pagePlan'

const tool = 'grid min-h-[4rem] place-items-center content-center gap-0.5 rounded-[16px] border border-[var(--border)] bg-white px-0.5 py-1.5 text-[0.75rem] font-bold leading-tight shadow-sm transition-transform active:scale-95 disabled:opacity-30'
const small = 'grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] disabled:opacity-30'

/**
 * The document's pages as thumbnails, with what you can do to the selected one right underneath:
 * move it earlier or later, turn it, or take it out. Undo/redo sit on the status line.
 */
export default function PageStrip({ pdf, ratio, state, perSheet = 1 }) {
  const { plan, cur, setSel, note, apply } = state
  const label = (i) => `Page ${i + 1}`
  return (
    <section aria-label="Your pages" className="mt-3 md:mt-1">
      <div className="flex items-center justify-between gap-2 text-sm" aria-live="polite" role="status">
        <span className="min-w-0 truncate font-bold text-[var(--muted)]">{note || `${plan.length} page${plan.length === 1 ? '' : 's'} will print`}</span>
        <span className="flex flex-none gap-1.5">
          <button type="button" aria-label="Undo" disabled={!state.canUndo} onClick={state.undo} className={small}><Undo2 size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Redo" disabled={!state.canRedo} onClick={state.redo} className={small}><Redo2 size={18} aria-hidden="true" /></button>
        </span>
      </div>

      <div role="listbox" aria-label="Pages" className="flex gap-2 overflow-x-auto px-0.5 pb-1.5 pt-3 [scrollbar-width:thin]">
        {plan.map((p, i) => {
          const together = perSheet > 1 && Math.floor(i / perSheet) === Math.floor(cur / perSheet) // pages that share the sheet on show
          return (
            <button key={i} type="button" role="option" aria-selected={i === cur} aria-label={label(i)} onClick={() => setSel(i)}
              className={`w-[3.375rem] flex-none rounded-[10px] border-2 p-0.5 text-center text-xs text-[var(--muted)] transition-all ${i === cur ? '-translate-y-1 border-accent bg-[var(--card)] shadow-[0_8px_18px_rgba(14,124,134,.3)]' : together ? 'border-accent/40' : 'border-transparent'}`}>
              <PageSheet pdf={pdf} item={p} ratio={ratio} renderWidth={110} lazy label="" />
              {i + 1}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={`Page ${cur + 1} actions`}>
        <button type="button" className={tool} disabled={cur === 0} onClick={() => apply((pl) => movePage(pl, cur, -1), `Page ${cur + 1} moved earlier`, cur - 1)}><ArrowLeft size={20} aria-hidden="true" />Move earlier</button>
        <button type="button" className={tool} disabled={cur >= plan.length - 1} onClick={() => apply((pl) => movePage(pl, cur, 1), `Page ${cur + 1} moved later`, cur + 1)}><ArrowRight size={20} aria-hidden="true" />Move later</button>
        <button type="button" className={tool} onClick={() => apply((pl) => rotatePage(pl, cur, -1), `Page ${cur + 1} turned left`)}><RotateCcw size={20} aria-hidden="true" />Turn left</button>
        <button type="button" className={tool} onClick={() => apply((pl) => rotatePage(pl, cur, 1), `Page ${cur + 1} turned right`)}><RotateCw size={20} aria-hidden="true" />Turn right</button>
        <button type="button" className={`${tool} text-danger`} disabled={plan.length <= 1} onClick={() => apply((pl) => removePage(pl, cur), `Page ${cur + 1} removed`, cur)}><Trash2 size={20} aria-hidden="true" />Remove</button>
      </div>
    </section>
  )
}
