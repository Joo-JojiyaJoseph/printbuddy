import { Link } from 'react-router-dom'
import { AlertTriangle, CircleDollarSign, ClipboardList, CreditCard, Database, FileWarning, Landmark, QrCode, ScanSearch } from 'lucide-react'
import { adminApi } from '../adminApi'
import { formatBytes, formatINR } from '../../utils/format'
import { Badge, Loading, Notice, PageHead, Panel, Table, dt, useLoad } from '../ui'

const TINTS = { violet: 'from-[#9a80ff] to-[#5a3fd0]', green: 'from-[#6ee7b7] to-[#0f9d74]', blue: 'from-[#7aa7ff] to-[#3f6fe0]', pink: 'from-[#ff9fbb] to-[#ec4a78]', amber: 'from-[#ffd36e] to-[#e59a0a]' }
function Stat({ label, value, sub, tone, icon: Icon, tint = 'violet', i = 0 }) {
  const bad = tone === 'bad'
  return (
    <div className="group relative min-w-0 animate-rise overflow-hidden rounded-2xl border border-white bg-white p-4 shadow-[0_1px_2px_rgba(31,27,61,.05),0_10px_26px_-12px_rgba(74,50,184,.25),0_0_0_1px_rgba(124,92,252,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_-14px_rgba(74,50,184,.38),0_0_0_1px_rgba(124,92,252,.14)]" style={{ animationDelay: `${i * 0.04}s` }}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bad ? 'from-[#ff8fa3] to-[#d9344a]' : TINTS[tint]}`} />
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
        {Icon && <span className={`tile3d grid size-9 flex-none place-items-center rounded-xl bg-gradient-to-br text-white ${bad ? 'from-[#ff8fa3] to-[#d9344a]' : TINTS[tint]}`}><Icon size={17} aria-hidden="true" /></span>}
      </div>
      <p className={`m-0 mt-2 text-[1.625rem] font-extrabold tracking-tight [overflow-wrap:anywhere] ${bad ? 'text-red-700' : ''}`}>{value}</p>
      {sub && <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const dash = useLoad(() => adminApi.dashboard())
  const recent = useLoad(() => adminApi.orders({ per_page: 6 }))
  const d = dash.data
  if (dash.loading || dash.error) return <><PageHead title="Dashboard" /><Loading error={dash.error} onRetry={dash.reload} /></>

  const alerts = []
  if (d.print_failed > 0) alerts.push(<>{d.print_failed} paid order(s) did not print. <Link className="font-semibold underline" to="/admin/orders?status=paid">Open orders</Link> and press “Retry print”.</>)
  if (d.payments_needing_review > 0) alerts.push(<>{d.payments_needing_review} payment(s) need review. <Link className="font-semibold underline" to="/admin/payments">Open payments</Link>.</>)
  if (d.conversion_driver === 'libreoffice' && !d.conversion_available) alerts.push('Office files (Word, Excel, PowerPoint) cannot be converted: LibreOffice is not available on the server.')
  if (d.payment_provider === 'fake') alerts.push(<>Payments are in sandbox mode: no real money is taken. Set up Razorpay in <Link className="font-semibold underline" to="/admin/payment">Payment gateway</Link>.</>)
  const by = Object.entries(d.orders_by_status || {})
  const max = Math.max(1, ...by.map(([, n]) => n))

  return (
    <>
      <PageHead title="Dashboard" sub="Today at a glance" />
      {alerts.length > 0 && (
        <div className="mb-4 grid gap-2">{alerts.map((a, i) => <Notice key={i} tone={i === 0 && d.print_failed > 0 ? 'bad' : 'warn'}>{a}</Notice>)}</div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat i={0} icon={CircleDollarSign} tint="green" label="Revenue today" value={formatINR(d.revenue_today_paise)} sub={`${d.paid_today} paid order(s)`} />
        <Stat i={1} icon={ClipboardList} tint="violet" label="Orders today" value={d.orders_today} />
        <Stat i={2} icon={Landmark} tint="blue" label="Revenue, all time" value={formatINR(d.revenue_total_paise)} />
        <Stat i={3} icon={QrCode} tint="violet" label="Active QR sessions" value={d.active_sessions} />
        <Stat i={4} icon={CreditCard} tint="amber" label="Payments pending" value={d.pending_payments} />
        <Stat i={5} icon={ScanSearch} tint="amber" label="Payments to review" value={d.payments_needing_review} tone={d.payments_needing_review ? 'bad' : undefined} />
        <Stat i={6} icon={FileWarning} tint="pink" label="Print failures" value={d.print_failed ?? 0} tone={d.print_failed ? 'bad' : undefined} />
        <Stat i={7} icon={Database} tint="blue" label="Files on disk" value={d.documents_on_disk} sub={formatBytes(d.storage_bytes)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Latest orders" action={<Link to="/admin/orders" className="text-xs font-semibold text-[var(--color-accent-2)]">View all</Link>}>
          {recent.loading ? <Loading /> : (
            <Table rows={recent.data?.data} rowKey={(r) => r.reference} cols={[
              { key: 'reference', label: 'Order', render: (r) => <span className="font-semibold">{r.reference}</span> },
              { key: 'document_name', label: 'File', render: (r) => <span className="block max-w-[14rem] truncate">{r.document_name}</span> },
              { key: 'total_paise', label: 'Total', render: (r) => formatINR(r.total_paise) },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'created_at', label: 'When', render: (r) => dt(r.created_at) },
            ]} />
          )}
        </Panel>
        <Panel title="Orders by status">
          {by.length === 0 ? <p className="m-0 text-sm text-[var(--muted)]">No orders yet.</p> : (
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {by.map(([s, n]) => (
                <li key={s}>
                  <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{s.replace(/_/g, ' ')}</span><b>{n}</b></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#ece7fb] shadow-[inset_0_1px_2px_rgba(74,50,184,.12)]"><div className="h-2.5 rounded-full bg-gradient-to-r from-[#9a80ff] to-[#6246e6] shadow-[0_0_8px_rgba(124,92,252,.5)] transition-[width] duration-700" style={{ width: `${(n / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 mt-4 flex items-center gap-1.5 text-xs text-[var(--muted)]"><AlertTriangle size={13} aria-hidden="true" />{d.documents_due_for_purge} file(s) waiting to be erased.</p>
        </Panel>
      </div>
    </>
  )
}
