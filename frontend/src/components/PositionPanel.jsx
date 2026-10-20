import { useState } from 'react'
import Segmented from './ui/Segmented'
import { ALIGN_OPTIONS, setAlign, setAlignAll, setAlignSide, sideOfPage } from '../utils/pagePlan'

// A tiny sheet showing where the page lands on the paper.
const GLYPH = {
  edge: { inset: 0 },
  center: { left: '12.5%', top: '12.5%', width: '75%', height: '75%' },
  tl: { left: 0, top: 0, width: '75%', height: '75%' },
  fill: { inset: 0, borderStyle: 'dashed' },
  actual: { left: '25%', top: '25%', width: '50%', height: '50%' },
}
function Glyph({ align }) {
  return (
    <span aria-hidden="true" className="relative block h-7 w-5 flex-none rounded-[2px] border border-[var(--border)] bg-white">
      <i className="absolute block border border-accent-2 bg-accent/25" style={GLYPH[align]} />
    </span>
  )
}

const same = (list) => (list.length && list.every((a) => a === list[0]) ? list[0] : null)
const nameOf = (a) => (a ? ALIGN_OPTIONS.find((o) => o.value === a)?.label ?? a : 'Mixed')

/** One line for the section header: where the pages sit now (front and back separately when double-sided). */
export function positionSummary(plan, duplex) {
  if (!duplex) return nameOf(same(plan.map((p) => p.align)))
  const side = (s) => same(plan.filter((_, i) => sideOfPage(i) === s).map((p) => p.align))
  return plan.length > 1 ? `Front: ${nameOf(side('front'))} · Back: ${nameOf(side('back'))}` : `Front: ${nameOf(side('front'))} · no back side`
}

/**
 * Where each page sits on the paper. Single-sided: all pages together, or just the one you picked.
 * Double-sided: the FRONT sides and the BACK sides are set separately (pages 1, 3, 5… and 2, 4, 6…),
 * because a back often needs a different margin or position than a front.
 */
export default function PositionPanel({ plan, cur, duplex, apply }) {
  const scopes = duplex
    ? [{ value: 'front', label: 'Front sides' }, { value: 'back', label: 'Back sides' }, { value: 'page', label: `Page ${cur + 1} only` }]
    : [{ value: 'all', label: 'All pages' }, { value: 'page', label: `Page ${cur + 1} only` }]
  const [chosen, setChosen] = useState(null)
  const scope = scopes.some((s) => s.value === chosen) ? chosen : scopes[0].value
  const hasBack = plan.length > 1

  const aligns = scope === 'page' ? [plan[cur]?.align]
    : scope === 'all' ? plan.map((p) => p.align)
      : plan.filter((_, i) => sideOfPage(i) === scope).map((p) => p.align)
  const value = same(aligns)
  const scopeLabel = scopes.find((s) => s.value === scope).label

  const choose = (align) => {
    const name = ALIGN_OPTIONS.find((o) => o.value === align).label
    const fn = scope === 'page' ? (pl) => setAlign(pl, cur, align) : scope === 'all' ? (pl) => setAlignAll(pl, align) : (pl) => setAlignSide(pl, scope, align)
    apply(fn, `${scopeLabel}: ${name}`)
  }

  return (
    <>
      <p className="m-0 text-xs text-[var(--muted)]">
        {duplex
          ? <>Double-sided: set the <b>front</b> (pages 1, 3, 5…) and the <b>back</b> (pages 2, 4, 6…) separately.{!hasBack && ' You only have one page, so there is no back side.'}</>
          : 'Choose where your pages sit on the paper.'}
      </p>
      <Segmented label="Apply position to" value={scope} onChange={setChosen} options={scopes} />
      <div role="radiogroup" aria-label={`Position for ${scopeLabel}`} className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {ALIGN_OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => choose(o.value)}
            className={`flex min-h-[2.875rem] items-center gap-2 rounded-[14px] border-[1.5px] px-2 text-left text-xs font-bold ${value === o.value ? 'border-accent bg-[#e3f3f3]' : 'border-[var(--border)] bg-white'}`}>
            <Glyph align={o.value} />{o.label}
          </button>
        ))}
      </div>
      {value === null && <p className="m-0 mt-1.5 text-xs text-[var(--muted)]">These pages have different positions. Pick one to make them all the same.</p>}
    </>
  )
}
