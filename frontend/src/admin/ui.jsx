import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

export const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
export const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/** Loads data on mount and whenever `deps` change; `reload()` refetches without a spinner flash. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const run = useCallback(async (quiet) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }))
    try { setState({ data: await fnRef.current(), error: null, loading: false }) } catch (e) { setState({ data: null, error: e.message || 'Could not load', loading: false }) }
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(false) }, deps)
  return { ...state, reload: () => run(true) }
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 flex items-center gap-2.5 text-[1.375rem] font-extrabold tracking-tight"><i aria-hidden="true" className="h-6 w-1.5 rounded-full bg-gradient-to-b from-[#9a80ff] to-[#ec4a78]" />{title}</h1>
        {sub && <p className="m-0 mt-1 pl-4 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white bg-white p-5 shadow-[0_1px_2px_rgba(31,27,61,.05),0_10px_28px_-12px_rgba(74,50,184,.22),0_0_0_1px_rgba(124,92,252,.07)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(31,27,61,.05),0_18px_36px_-14px_rgba(74,50,184,.3),0_0_0_1px_rgba(124,92,252,.12)] ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/70 pb-3">
          {title && <h2 className="m-0 text-base font-bold tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

const TONES = {
  good: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  bad: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  mute: 'bg-slate-100 text-slate-600 ring-slate-200',
}
export const STATUS_TONE = {
  paid: 'good', succeeded: 'good', sent: 'good', active: 'info', completed: 'good',
  awaiting_payment: 'warn', pending: 'warn', waiting: 'warn', queued: 'warn', preparing: 'warn', sending: 'warn',
  failed: 'bad', cancelled: 'mute', expired: 'mute', draft: 'mute',
}
export function Badge({ tone, children }) {
  const t = tone || STATUS_TONE[children] || 'mute'
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${TONES[t]}`}><i aria-hidden="true" className="size-1.5 rounded-full bg-current" />{String(children).replace(/_/g, ' ')}</span>
}

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'good' ? CheckCircle2 : AlertCircle
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm shadow-[0_2px_8px_-4px_rgba(31,27,61,.2)] ring-1 ring-inset ${TONES[tone]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

const BTN = {
  solid: 'bg-gradient-to-b from-[#8f74ff] to-[#6246e6] text-white shadow-[0_3px_0_#4a32b8,0_8px_14px_-4px_rgba(74,50,184,.45),inset_0_1px_0_rgba(255,255,255,.35)] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5 active:shadow-[0_1px_0_#4a32b8]',
  ghost: 'bg-white text-[var(--text)] ring-1 ring-inset ring-[#d6cdf3] shadow-[0_2px_0_#e4dcfb] hover:-translate-y-0.5 hover:bg-[#f7f4ff] hover:ring-[#b9a9ef] active:translate-y-0.5 active:shadow-none',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 shadow-[0_2px_0_#fbd5d5] hover:-translate-y-0.5 hover:bg-red-50 active:translate-y-0.5 active:shadow-none',
}
export function Btn({ variant = 'ghost', className = '', loading, children, ...p }) {
  return (
    <button type="button" {...p} disabled={p.disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold transition duration-150 disabled:pointer-events-none disabled:opacity-50 ${BTN[variant]} ${className}`}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export const inputCls = 'min-h-10 w-full rounded-xl border border-[#ddd5f5] bg-white px-3 text-sm shadow-[inset_0_1px_2px_rgba(74,50,184,.06)] outline-none transition hover:border-[#b9a9ef] focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/15'
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  )
}

/** Scrolls sideways inside its own box on small screens, so a wide table never widens the page. */
export function Table({ cols, rows, onRow, empty = 'Nothing here yet.', rowKey }) {
  if (!rows?.length) return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-[#d6cdf3] bg-[#faf8ff] py-10 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--color-accent)] shadow-[0_6px_14px_-4px_rgba(74,50,184,.3)]"><Inbox size={20} aria-hidden="true" /></span>
      <p className="m-0 text-sm text-[var(--muted)]">{empty}</p>
    </div>
  )
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-b from-[#f7f4ff] to-[#efeafc] text-left text-[0.6875rem] uppercase tracking-wider text-[#5c5486]">
            {cols.map((c) => <th key={c.key} className={`whitespace-nowrap border-b border-[var(--border)] px-3 py-2.5 font-bold ${c.className || ''}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} onClick={onRow ? () => onRow(r) : undefined}
              onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r) } : undefined} tabIndex={onRow ? 0 : undefined}
              className={`border-b border-[var(--border)]/60 transition-colors last:border-0 even:bg-[#fcfbff] ${onRow ? 'cursor-pointer hover:bg-[#f1ecff] focus-visible:bg-[#f1ecff] focus-visible:outline-none' : 'hover:bg-[#f8f6ff]'}`}>
              {cols.map((c) => <td key={c.key} className={`px-3 py-3 align-middle ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pager({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return meta ? <p className="m-0 mt-3 text-xs text-[var(--muted)]">{meta.total} total</p> : null
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-[var(--muted)]">{meta.total} total</span>
      <div className="flex items-center gap-1">
        <Btn aria-label="Previous page" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}><ChevronLeft size={16} /></Btn>
        <span className="px-2 text-xs">Page {meta.current_page} of {meta.last_page}</span>
        <Btn aria-label="Next page" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}><ChevronRight size={16} /></Btn>
      </div>
    </div>
  )
}

export function Loading({ error, onRetry }) {
  if (error) return <Notice tone="bad">{error} {onRetry && <button type="button" className="font-semibold underline" onClick={onRetry}>Try again</button>}</Notice>
  return <div role="status" aria-label="Loading" className="grid place-items-center py-10"><div className="size-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--color-accent)]" /></div>
}

/** Debounce for search boxes. */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
