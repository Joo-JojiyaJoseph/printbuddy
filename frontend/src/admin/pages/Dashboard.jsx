import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { adminApi } from '../adminApi'
import { formatBytes, formatINR } from '../../utils/format'
import { Badge, Loading, Notice, PageHead, Panel, Table, dt, useLoad } from '../ui'

function Stat({ label, value, sub, tone }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="m-0 text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className={`m-0 mt-1 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] ${tone === 'bad' ? 'text-red-700' : ''}`}>{value}</p>
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
  if (!d.conversion_available) alerts.push('Office files (Word, Excel, PowerPoint) cannot be converted: LibreOffice is not available on the server.')
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
        <Stat label="Revenue today" value={formatINR(d.revenue_today_paise)} sub={`${d.paid_today} paid order(s)`} />
        <Stat label="Orders today" value={d.orders_today} />
        <Stat label="Revenue, all time" value={formatINR(d.revenue_total_paise)} />
        <Stat label="Active QR sessions" value={d.active_sessions} />
        <Stat label="Payments pending" value={d.pending_payments} />
        <Stat label="Payments to review" value={d.payments_needing_review} tone={d.payments_needing_review ? 'bad' : undefined} />
        <Stat label="Print failures" value={d.print_failed ?? 0} tone={d.print_failed ? 'bad' : undefined} />
        <Stat label="Files on disk" value={d.documents_on_disk} sub={formatBytes(d.storage_bytes)} />
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
                  <div className="h-2 rounded-full bg-[var(--hi)]"><div className="h-2 rounded-full bg-[var(--color-accent)]" style={{ width: `${(n / max) * 100}%` }} /></div>
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
