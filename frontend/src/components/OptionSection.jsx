import { ChevronDown } from 'lucide-react'

/**
 * One collapsible group of options. The header always shows what is currently chosen ("A4 · Portrait"), so a customer
 * can see their settings without opening anything and only opens what they want to change. The content stays in the page
 * (just hidden) so what was typed or picked inside is not lost when it is closed.
 */
export default function OptionSection({ id, icon: Icon, title, summary, warn = false, open, onToggle, children }) {
  return (
    <section className={`rounded-2xl border bg-white ${open ? 'border-accent/60 shadow-[0_6px_18px_rgba(10,74,82,.08)]' : 'border-[var(--border)]'}`}>
      <h3 className="m-0">
        <button type="button" id={`${id}-h`} aria-expanded={open} aria-controls={`${id}-p`} onClick={onToggle}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left">
          {Icon && <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-xl bg-[var(--hi)] text-accent-2"><Icon size={18} /></span>}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{title}</span>
            <span className={`block truncate text-xs ${warn ? 'font-bold text-danger' : 'text-[var(--muted)]'}`}>{summary}</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className={`flex-none text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div id={`${id}-p`} role="region" aria-labelledby={`${id}-h`} hidden={!open} className="space-y-3 px-3 pb-3 pt-1">{children}</div>
    </section>
  )
}
