import { useState } from 'react'
import { Check, LayoutGrid, Palette, RotateCw, Sparkles } from 'lucide-react'
import Modal from './ui/Modal'

/** Builds the list of suggestions from what the on-device analysis found. Pure, so it is easy to test. */
export function suggestionsFor(insights, settings, isImage = false, pageCount = 0) {
  if (!insights) return []
  const out = []
  if (!insights.hasColour && settings.color_mode === 'color') {
    out.push({ id: 'bw', icon: Palette, title: 'No colour found: print in black & white', why: 'Every page we checked is black and white, so colour ink would add cost without changing how it looks.', patch: { color_mode: 'bw' } })
  } else if (insights.hasColour && settings.color_mode === 'bw') {
    out.push({ id: 'colour', icon: Palette, title: 'Your document has colour', why: `We found colour on ${insights.colourPages} of ${insights.sampled} pages we checked (charts, logos or photos). Black & white will turn these grey. Colour costs more.`, patch: { color_mode: 'color' } })
  }
  if (!isImage) {
    if (insights.mostlyLandscape && settings.orientation === 'portrait') out.push({ id: 'land', icon: RotateCw, title: 'Pages are wide: use landscape paper', why: 'Most pages are wider than they are tall, so landscape paper fills the sheet instead of leaving big margins.', patch: { orientation: 'landscape' } })
    if (insights.mostlyPortrait && settings.orientation === 'landscape') out.push({ id: 'port', icon: RotateCw, title: 'Pages are tall: use portrait paper', why: 'Most pages are taller than they are wide, so portrait paper fits them best.', patch: { orientation: 'portrait' } })
  }
  // Slides (wide pages) are small and sparse: two to a sheet reads fine and halves the paper.
  if (!isImage && insights.mostlyLandscape && (settings.pages_per_sheet ?? 1) === 1 && pageCount >= 4) {
    const saved = pageCount - Math.ceil(pageCount / 2)
    out.push({ id: 'nup', icon: LayoutGrid, title: 'Looks like slides: print 2 per sheet', why: `Wide pages like slides stay easy to read at half size. Two to a sheet uses ${Math.ceil(pageCount / 2)} sheets instead of ${pageCount} and saves ${saved} ${saved === 1 ? 'sheet' : 'sheets'}. You can choose 4, 6 or 9 per sheet under Pages per sheet.`, patch: { pages_per_sheet: 2, orientation: 'portrait' } })
  }
  return out
}

/** "Smart assistant": reads the document on this phone and offers one-tap fixes. No data is sent anywhere. */
export default function SmartAssistant({ state, insights, settings, onApply, isImage, pageCount = 0 }) {
  const [why, setWhy] = useState(null)
  if (state === 'unavailable') return null
  const list = state === 'done' ? suggestionsFor(insights, settings, isImage, pageCount) : []
  return (
    <section aria-label="Smart assistant" aria-live="polite" className="relative mb-3 overflow-hidden rounded-[22px] border border-white/70 bg-gradient-to-br from-[#ece6ff]/90 via-white/80 to-[#f6f2ff]/90 p-3.5 shadow-[0_10px_30px_rgba(74,50,184,.12)] backdrop-blur-xl">
      <h3 className="m-0 flex items-center gap-2 text-sm font-bold">
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white"><Sparkles size={16} aria-hidden="true" className="animate-twinkle" /></span>
        Smart assistant
        <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-[var(--muted)]">on your phone</span>
      </h3>
      {state === 'analyzing' && (
        <div role="status" className="mt-3">
          <p className="m-0 text-sm text-[var(--muted)]">Looking at your document…</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hi)]"><i className="block h-full w-1/3 rounded-full bg-gradient-to-r from-accent to-accent-2 animate-slide" /></div>
        </div>
      )}
      {state === 'done' && !list.length && (
        <p className="m-0 mt-2.5 flex items-center gap-2 text-sm"><Check size={18} aria-hidden="true" className="text-mint" strokeWidth={3} /> Your settings look good for this document.</p>
      )}
      {list.length > 0 && (
        <ul className="m-0 mt-2.5 grid list-none gap-2 p-0">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 rounded-2xl bg-white/80 p-2.5 animate-rise">
              <s.icon size={20} aria-hidden="true" className="flex-none text-accent-2" />
              <span className="min-w-0 flex-1 text-sm"><b>{s.title}</b>{' '}
                <button type="button" onClick={() => setWhy(s)} className="font-bold text-accent underline">Why?</button>
              </span>
              <button type="button" onClick={() => onApply(s.patch)} className="min-h-10 flex-none rounded-full bg-gradient-to-r from-accent to-accent-2 px-4 text-sm font-bold text-white">Apply</button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!why} onClose={() => setWhy(null)} title={why?.title}>
        <p className="mb-4 mt-2 text-sm text-[var(--muted)]">{why?.why}</p>
        <p className="mb-4 mt-0 text-xs text-[var(--muted)]">This check runs on your phone. Your document is not sent to any AI service.</p>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setWhy(null)} className="min-h-12 flex-1 rounded-full border border-[var(--border)] bg-white font-bold">Not now</button>
          <button type="button" onClick={() => { onApply(why.patch); setWhy(null) }} className="min-h-12 flex-1 rounded-full bg-gradient-to-r from-accent to-accent-2 font-bold text-white">Apply</button>
        </div>
      </Modal>
    </section>
  )
}
