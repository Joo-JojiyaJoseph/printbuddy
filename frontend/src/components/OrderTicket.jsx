import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { describeSettings } from '../utils/printOptions'
import { formatINR } from '../utils/format'
import { IS_MOCK } from '../services/api'

/** Counts the amount up to its value once, so the total feels alive. Instant when the device asks for less motion. */
function CountUp({ paise }) {
  const [v, setV] = useState(paise)
  const from = useRef(paise)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(paise); return undefined }
    const start = performance.now(); const a = from.current; let raf
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 700)
      setV(Math.round(a + (paise - a) * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = paise
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paise])
  return <span aria-label={formatINR(paise)}>{formatINR(v)}</span>
}

/** A row on the paper slip: label on the left, value on the right, dashed rule between. Rows slide in one after another. */
const Line = ({ k, v, i }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-[var(--border)] py-2.5 text-[0.9375rem] last:border-0 animate-rise" style={{ animationDelay: `${0.08 + i * 0.05}s` }}>
    <dt className="text-[var(--muted)]">{k}</dt><dd className="m-0 text-right font-bold">{v}</dd>
  </div>
)

/** Rounded 3D slip that tilts a little under the pointer; it has a notched, stacked-paper edge. */
function Slip({ children, className = '', ...rest }) {
  const el = useRef(null)
  const tilt = (e) => {
    const n = el.current
    if (!n || window.matchMedia?.('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return
    const r = n.getBoundingClientRect()
    n.style.transform = `perspective(900px) rotateX(${(-((e.clientY - r.top) / r.height - 0.5) * 5).toFixed(2)}deg) rotateY(${(((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2)}deg) translateY(-2px)`
  }
  return (
    <div className="relative [perspective:900px]">
      <span aria-hidden="true" className="absolute inset-x-3 -bottom-1.5 h-4 rounded-b-3xl bg-[#e4dcfb] opacity-80" />
      <span aria-hidden="true" className="absolute inset-x-6 -bottom-3 h-4 rounded-b-3xl bg-[#efeaff] opacity-70" />
      <section ref={el} onPointerMove={tilt} onPointerLeave={() => { if (el.current) el.current.style.transform = '' }} {...rest}
        className={`clay relative rounded-[26px] p-4 transition-transform duration-200 ease-out ${className}`}>{children}</section>
    </div>
  )
}

/** The order: file and print settings on one slip, price on another. Used on the review and confirmation pages. */
export function SettingsSlip({ name, settings, sub = '1 file' }) {
  const rows = describeSettings(settings)
  return (
    <Slip aria-label="Print settings">
      <div className="flex items-center gap-3 border-b border-dashed border-[var(--border)] pb-3">
        <span className="tile3d grid size-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-[#9a80ff] to-[#5a3fd0] text-white animate-bob"><FileText size={22} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="m-0 truncate font-bold">{name}</p><p className="m-0 text-sm text-[var(--muted)]">{sub}</p></div>
      </div>
      <dl className="m-0">{rows.map(([k, v], i) => <Line key={k} k={k} v={v} i={i} />)}</dl>
    </Slip>
  )
}

export function PriceSlip({ quote, loading, error }) {
  return (
    <Slip aria-busy={loading} aria-live="polite" aria-label="Price" className="mt-4">
      <h3 className="m-0 mb-1 text-base font-extrabold">Price</h3>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!quote && !error && <div className="h-24 animate-pulse rounded-2xl bg-[var(--hi)]" role="status" aria-label="Calculating price" />}
      {quote && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <dl className="m-0">
            <Line i={0} k={quote.pages_per_sheet > 1
              ? `${quote.pages_selected} ${quote.pages_selected === 1 ? 'page' : 'pages'}, ${quote.pages_per_sheet} per sheet × ${quote.copies} ${quote.copies === 1 ? 'copy' : 'copies'}`
              : `${quote.pages_selected} ${quote.pages_selected === 1 ? 'page' : 'pages'} × ${quote.copies} ${quote.copies === 1 ? 'copy' : 'copies'}`}
              v={`${quote.billable_sides} ${quote.billable_sides === 1 ? 'side' : 'sides'}`} />
            <Line i={1} k="Rate per side" v={formatINR(quote.effective_per_side_rate_paise)} />
            <Line i={2} k="Subtotal" v={formatINR(quote.subtotal_paise)} />
            {quote.service_fee_paise > 0 && <Line i={3} k="Service fee" v={formatINR(quote.service_fee_paise)} />}
            {quote.tax_paise > 0 && <Line i={4} k="Tax" v={formatINR(quote.tax_paise)} />}
          </dl>
          <div className="relative mt-3 flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#efe9ff] to-[#e2d9ff] px-4 py-3.5 font-extrabold shadow-[inset_0_2px_0_rgba(255,255,255,.9),inset_0_-6px_12px_rgba(124,92,252,.12),0_8px_16px_-8px_rgba(74,50,184,.3)]">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-[sheen_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <span className="relative">Total</span>
            <span className="relative text-2xl text-primary" data-testid="quote-total"><CountUp paise={quote.total_paise} /></span>
          </div>
          <p className="m-0 mt-2 text-xs text-[var(--muted)]">{quote.sheets} {quote.sheets === 1 ? 'sheet' : 'sheets'} of paper</p>
        </div>
      )}
      {IS_MOCK && <p className="m-0 mt-2 text-xs text-amber">Demo pricing from the mock API. The Laravel server calculates real prices.</p>}
    </Slip>
  )
}
