import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { adminApi } from '../adminApi'
import { formatINR } from '../../utils/format'
import { Btn, Field, Loading, Notice, PageHead, Panel, Table, inputCls, useLoad } from '../ui'

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

/** One series, one hue: bars anchored to the baseline, hover or keyboard focus shows the exact figure. */
function RevenueChart({ daily }) {
  const [hover, setHover] = useState(null)
  const W = 720, H = 220, L = 46, B = 26, T = 10
  const max = Math.max(100, ...daily.map((d) => d.revenue_paise))
  const nice = useMemo(() => { const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p }, [max])
  const bw = (W - L) / daily.length
  const y = (v) => T + (H - T - B) * (1 - v / nice)
  const ticks = [0, 0.5, 1].map((f) => nice * f)
  const every = Math.ceil(daily.length / 8)
  const h = hover != null ? daily[hover] : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue per day" className="block h-auto w-full">
        {ticks.map((t) => (
          <g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#e1daf5" strokeWidth="1" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6a6790">{`₹${Math.round(t / 100)}`}</text></g>
        ))}
        {daily.map((d, i) => {
          const x = L + i * bw
          const top = y(d.revenue_paise)
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${short(d.date)}: ${formatINR(d.revenue_paise)}, ${d.orders} orders`}>
              <rect x={x} y={T} width={bw} height={H - T - B} fill="transparent" />
              {d.revenue_paise > 0 && <path d={`M${x + bw * 0.15},${H - B} V${top + 3} a3,3 0 0 1 3,-3 h${Math.max(1, bw * 0.7 - 6)} a3,3 0 0 1 3,3 V${H - B} Z`} fill={hover === i ? '#4a32b8' : '#7c5cfc'} />}
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6a6790">{short(d.date)}</text>}
            </g>
          )
        })}
        <line x1={L} x2={W} y1={H - B} y2={H - B} stroke="#a9a5c8" strokeWidth="1" />
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-lg bg-[#1f1b3d] px-2.5 py-1.5 text-xs text-white shadow-lg">
          <b>{short(h.date)}</b> · {formatINR(h.revenue_paise)} · {h.orders} order{h.orders === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
}

function Breakdown({ title, rows, label = (k) => k }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue_paise))
  return (
    <Panel title={title}>
      {rows.length === 0 ? <p className="m-0 text-sm text-[var(--muted)]">No sales in this period.</p> : (
        <ul className="m-0 grid list-none gap-2.5 p-0">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex justify-between gap-2 text-xs"><span className="min-w-0 truncate">{label(r.key)} · {r.orders} order{r.orders === 1 ? '' : 's'}</span><b className="shrink-0">{formatINR(r.revenue_paise)}</b></div>
              <div className="h-2 rounded-full bg-[var(--hi)]"><div className="h-2 rounded-full bg-[var(--color-accent)]" style={{ width: `${(r.revenue_paise / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [table, setTable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const rep = useLoad(() => adminApi.sales({ from, to }), [from, to])
  const preset = (n) => { setFrom(daysAgo(n)); setTo(today()) }
  const download = async () => {
    setBusy(true); setErr('')
    try {
      const blob = await adminApi.csv({ from, to })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `taprint-orders-${from}-to-${to}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const r = rep.data
  return (
    <>
      <PageHead title="Reports" sub="Sales from paid orders. Dates use the server’s time zone.">
        <Btn variant="solid" loading={busy} onClick={download}><Download size={15} aria-hidden="true" />Download CSV</Btn>
      </PageHead>
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr] sm:items-end">
          <Field label="From"><input className={inputCls} type="date" max={to} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input className={inputCls} type="date" min={from} max={today()} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">{[['7 days', 6], ['30 days', 29], ['90 days', 89]].map(([l, n]) => <Btn key={l} onClick={() => preset(n)}>{l}</Btn>)}</div>
        </div>
        {err && <div className="mt-3"><Notice tone="bad">{err}</Notice></div>}
      </Panel>
      {rep.loading && !r ? <Loading /> : rep.error ? <Loading error={rep.error} onRetry={rep.reload} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[['Revenue', formatINR(r.totals.revenue_paise)], ['Paid orders', r.totals.orders], ['Average order', formatINR(r.totals.average_order_paise)], ['Sides printed', r.totals.billable_sides]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-[var(--border)] bg-white p-4"><p className="m-0 text-xs font-semibold text-[var(--muted)]">{l}</p><p className="m-0 mt-1 text-2xl font-bold tracking-tight">{v}</p></div>
            ))}
          </div>
          <Panel title="Revenue per day" action={<Btn onClick={() => setTable((t) => !t)}>{table ? 'Show chart' : 'Show table'}</Btn>}>
            {table ? <Table rows={r.daily.filter((d) => d.orders)} rowKey={(d) => d.date} empty="No sales in this period." cols={[{ key: 'date', label: 'Date' }, { key: 'orders', label: 'Orders' }, { key: 'revenue_paise', label: 'Revenue', render: (d) => formatINR(d.revenue_paise) }]} /> : <RevenueChart daily={r.daily} />}
          </Panel>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Breakdown title="By paper size" rows={r.by_paper} />
            <Breakdown title="By colour" rows={r.by_color} label={(k) => (k === 'color' ? 'Colour' : k === 'bw' ? 'Black & white' : k)} />
            <Breakdown title="By kiosk" rows={r.by_kiosk} />
          </div>
        </>
      )}
    </>
  )
}
