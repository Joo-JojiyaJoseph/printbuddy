import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

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
        <h1 className="m-0 text-xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="m-0 mt-1 text-sm text-[var(--muted)]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_4px_16px_rgba(74,50,184,.06)] ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="m-0 text-[0.9375rem] font-bold">{title}</h2>}
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
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[t]}`}>{String(children).replace(/_/g, ' ')}</span>
}

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'good' ? CheckCircle2 : AlertCircle
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-inset ${TONES[tone]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

const BTN = {
  solid: 'bg-[var(--color-accent-2)] text-white hover:bg-[var(--color-accent)]',
  ghost: 'bg-white text-[var(--text)] ring-1 ring-inset ring-[var(--border)] hover:bg-[var(--hi)]',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50',
}
export function Btn({ variant = 'ghost', className = '', loading, children, ...p }) {
  return (
    <button type="button" {...p} disabled={p.disabled || loading}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50 ${BTN[variant]} ${className}`}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export const inputCls = 'min-h-9 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20'
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
  if (!rows?.length) return <p className="m-0 py-8 text-center text-sm text-[var(--muted)]">{empty}</p>
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            {cols.map((c) => <th key={c.key} className={`whitespace-nowrap px-2 py-2 font-semibold ${c.className || ''}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i} onClick={onRow ? () => onRow(r) : undefined}
              onKeyDown={onRow ? (e) => { if (e.key === 'Enter') onRow(r) } : undefined} tabIndex={onRow ? 0 : undefined}
              className={`border-b border-[var(--border)]/60 last:border-0 ${onRow ? 'cursor-pointer hover:bg-[var(--hi)] focus-visible:bg-[var(--hi)]' : ''}`}>
              {cols.map((c) => <td key={c.key} className={`px-2 py-2.5 align-middle ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
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
