import { useState } from 'react'
import { FileText, LayoutGrid, Minus, Plus, Ruler } from 'lucide-react'
import OptionSection from './OptionSection'
import Segmented from './ui/Segmented'
import PerSheetPicker from './PerSheetPicker'
import { PAPER_SIZES } from '../utils/printOptions'

const label = 'text-sm font-bold'
const row = 'flex items-center justify-between gap-3'

/**
 * The print options, in two layers so nobody has to read a long list:
 *  1. the three things people change most (copies, colour, sides) are always on screen;
 *  2. everything else sits in sections that each show their current value and open on tap (one at a time).
 * `lead` / `tail` are extra sections the page adds before / after the standard ones: { id, icon, title, summary, content }.
 */
export default function PrintSettingsForm({ value, onChange, rangeError, pageCount, showLayout = false, lead = [], tail = [], open: openProp, onOpenChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const [own, setOwn] = useState(null)
  const controlled = openProp !== undefined
  const current = controlled ? openProp : own
  const setOpen = (id) => (controlled ? onOpenChange?.(id) : setOwn(id))
  const step = (d) => set('copies', Math.min(100, Math.max(1, value.copies + d)))
  const perSheet = value.pages_per_sheet ?? 1

  const standard = [
    { id: 'paper', icon: Ruler, title: 'Paper & orientation', summary: `${value.paper_size} · ${value.orientation === 'landscape' ? 'Landscape' : 'Portrait'}`,
      content: <>
        <div><span className={`${label} mb-1.5 block`}>Paper size</span>
          <Segmented label="Paper size" value={value.paper_size} onChange={(v) => set('paper_size', v)} options={PAPER_SIZES.map((p) => ({ value: p, label: p }))} /></div>
        <div><span className={`${label} mb-1.5 block`}>Orientation</span>
          <Segmented label="Orientation" value={value.orientation} onChange={(v) => set('orientation', v)}
            options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} /></div>
      </> },
    ...(showLayout ? [{ id: 'persheet', icon: LayoutGrid, title: 'Pages per sheet', summary: perSheet === 1 ? 'One page per sheet' : `${perSheet} pages per sheet`,
      content: <>
        <PerSheetPicker value={perSheet} onChange={(v) => set('pages_per_sheet', v)} orientation={value.orientation} pageCount={pageCount} />
        <p className="m-0 text-xs text-[var(--muted)]">Slides or pages side by side on one sheet, like a handout. More per sheet uses less paper and costs less. Each page is fitted whole into its own box.</p>
      </> }] : []),
    { id: 'range', icon: FileText, title: showLayout ? 'Pages to print' : 'Sheets to print', summary: rangeError ? 'Check this: ' + rangeError : value.page_range?.trim() || (showLayout ? 'All pages' : 'All sheets'), warn: !!rangeError,
      content: <div>
        <label htmlFor="page-range" className={`${label} mb-1.5 block`}>{showLayout ? 'Pages' : 'Sheets'}{pageCount ? ` (1–${pageCount})` : ''}</label>
        <input id="page-range" type="text" inputMode="text" autoComplete="off" value={value.page_range}
          onChange={(e) => set('page_range', e.target.value)} placeholder={showLayout ? 'All pages, or e.g. 1-3,5' : 'All sheets, or e.g. 1-2'}
          aria-invalid={!!rangeError} aria-describedby={rangeError ? 'range-error' : undefined}
          className="min-h-[3rem] w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 text-base" />
        {rangeError && <p id="range-error" role="alert" className="mt-1 text-sm text-danger">{rangeError}</p>}
      </div> },
  ]
  const sections = [...lead, ...standard, ...tail]
  // A page range that does not fit must be seen, not hidden in a closed section.
  const shown = rangeError && current === null ? 'range' : current

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-3">
        <div className={row}>
          <span className={label} id="copies-l">Copies</span>
          <div className="flex items-center gap-4 text-lg font-bold" role="group" aria-labelledby="copies-l">
            <button type="button" aria-label="Fewer copies" disabled={value.copies <= 1} onClick={() => step(-1)}
              className="grid size-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Minus size={18} aria-hidden="true" /></button>
            <output aria-live="polite" aria-label="Number of copies" className="min-w-6 text-center">{value.copies}</output>
            <button type="button" aria-label="More copies" disabled={value.copies >= 100} onClick={() => step(1)}
              className="grid size-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Plus size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <div><span className={`${label} mb-1.5 block`}>Colour</span>
          <Segmented label="Colour" value={value.color_mode} onChange={(v) => set('color_mode', v)}
            options={[{ value: 'bw', label: 'Black & white' }, { value: 'color', label: 'Colour' }]} /></div>
        <div><span className={`${label} mb-1.5 block`}>Sides</span>
          <Segmented label="Sides" value={value.duplex ? 'double' : 'single'} onChange={(v) => set('duplex', v === 'double')}
            options={[{ value: 'single', label: 'Single-sided' }, { value: 'double', label: 'Double-sided' }]} />
          {value.duplex && sections.some((s) => s.id === 'position') && (
            <p className="m-0 mt-1.5 text-xs text-[var(--muted)]">Front and back can sit differently on the paper. <button type="button" onClick={() => setOpen('position')} className="font-bold text-accent-2 underline">Set front &amp; back</button></p>
          )}
        </div>
      </div>

      <div className="space-y-2" role="group" aria-label="More options">
        {sections.map((s) => (
          <OptionSection key={s.id} id={`opt-${s.id}`} icon={s.icon} title={s.title} summary={s.summary} warn={s.warn} open={shown === s.id}
            onToggle={() => setOpen(shown === s.id ? null : s.id)}>{s.content}</OptionSection>
        ))}
      </div>
    </div>
  )
}
