import { Leaf } from 'lucide-react'
import { formatINR } from '../utils/format'

/** Money- and paper-saving suggestions priced by the server; one tap applies a suggestion. */
export default function SavingsTip({ tips, onApply }) {
  if (!tips?.length) return null
  return (
    <section aria-label="Ways to save" className="mt-3 rounded-[var(--radius-card)] border border-accent/40 bg-accent/10 p-3">
      <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold"><Leaf size={16} aria-hidden="true" className="text-accent" />Save on this print</h3>
      <ul className="m-0 mt-2 list-none space-y-2 p-0">
        {tips.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2">
            <span className="text-sm"><b>{t.title}</b> and save {formatINR(t.saving)}{t.sheetsSaved > 0 ? ` · ${t.sheetsSaved} fewer ${t.sheetsSaved === 1 ? 'sheet' : 'sheets'} of paper` : ''}</span>
            <button type="button" onClick={() => onApply(t.patch)} className="min-h-11 flex-none rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 text-sm font-bold text-white">Apply</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
