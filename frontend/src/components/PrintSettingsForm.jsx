import { Minus, Plus } from 'lucide-react'
import Segmented from './ui/Segmented'
import PerSheetPicker from './PerSheetPicker'
import { PAPER_SIZES } from '../utils/printOptions'

const label = 'mb-1.5 block text-sm font-bold'
export default function PrintSettingsForm({ value, onChange, rangeError, pageCount, showLayout = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const packed = showLayout && (value.pages_per_sheet ?? 1) > 1 // each page is fitted into its own box, so Scaling does not apply
  const step = (d) => set('copies', Math.min(100, Math.max(1, value.copies + d)))
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="page-range" className={label}>Pages{pageCount ? ` (1–${pageCount})` : ''}</label>
        <input id="page-range" type="text" inputMode="text" autoComplete="off" value={value.page_range}
          onChange={(e) => set('page_range', e.target.value)} placeholder="All pages, or e.g. 1-3,5"
          aria-invalid={!!rangeError} aria-describedby={rangeError ? 'range-error' : undefined}
          className="min-h-[3rem] w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 text-base" />
        {rangeError && <p id="range-error" role="alert" className="mt-1 text-sm text-danger">{rangeError}</p>}
      </div>
      <div>
        <span className={label}>Copies</span>
        <div className="flex items-center justify-center gap-5 text-xl font-bold">
          <button type="button" aria-label="Fewer copies" disabled={value.copies <= 1} onClick={() => step(-1)}
            className="grid size-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Minus aria-hidden="true" /></button>
          <output aria-live="polite" aria-label="Number of copies">{value.copies}</output>
          <button type="button" aria-label="More copies" disabled={value.copies >= 100} onClick={() => step(1)}
            className="grid size-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] disabled:opacity-30"><Plus aria-hidden="true" /></button>
        </div>
      </div>
      <div><span className={label}>Colour</span>
        <Segmented label="Colour" value={value.color_mode} onChange={(v) => set('color_mode', v)}
          options={[{ value: 'bw', label: 'Black & white' }, { value: 'color', label: 'Colour' }]} /></div>
      <div><span className={label}>Paper size</span>
        <Segmented label="Paper size" value={value.paper_size} onChange={(v) => set('paper_size', v)}
          options={PAPER_SIZES.map((p) => ({ value: p, label: p }))} /></div>
      <div><span className={label}>Orientation</span>
        <Segmented label="Orientation" value={value.orientation} onChange={(v) => set('orientation', v)}
          options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} /></div>
      {showLayout && (
        <div><span className={label}>Pages per sheet</span>
          <PerSheetPicker value={value.pages_per_sheet ?? 1} onChange={(v) => set('pages_per_sheet', v)} orientation={value.orientation} pageCount={pageCount} />
          <p className="m-0 mt-1.5 text-xs text-[var(--muted)]">Slides or pages shown side by side on one sheet, like a handout. More per sheet uses less paper and costs less. Each page is fitted whole into its own box.</p>
        </div>
      )}
      <div><span className={label}>Sides</span>
        <Segmented label="Sides" value={value.duplex ? 'double' : 'single'} onChange={(v) => set('duplex', v === 'double')}
          options={[{ value: 'single', label: 'Single-sided' }, { value: 'double', label: 'Double-sided' }]} /></div>
      {!packed && <div><span className={label}>Scaling</span>
        <Segmented label="Scaling" value={value.scaling} onChange={(v) => set('scaling', v)}
          options={[{ value: 'fit', label: 'Fit' }, { value: 'fill', label: 'Fill' }, { value: 'actual', label: 'Actual size' }]} /></div>}
    </div>
  )
}
