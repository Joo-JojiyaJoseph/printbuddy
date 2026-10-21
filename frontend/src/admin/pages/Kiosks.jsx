import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Monitor } from 'lucide-react'
import { useState } from 'react'
import { adminApi } from '../adminApi'
import { downloadShopSetup } from '../setupDownload'
import { useAdmin } from '../AdminApp'
import { formatINR } from '../../utils/format'
import { Badge, Btn, Loading, Notice, PageHead, Panel, Table, dt, useLoad } from '../ui'

const agentBadge = (a) => <Badge tone={a?.online ? 'good' : a?.key_set ? 'warn' : 'mute'}>{a?.online ? 'printing ready' : a?.key_set ? 'shop PC not connected' : 'no print key yet'}</Badge>

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-sm">
      <p className="m-0 text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className="m-0 mt-1 text-xl font-bold leading-tight">{value}</p>
      {sub && <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

function KioskList() {
  const { data, loading, error, reload } = useLoad(() => adminApi.kiosks())
  return (
    <>
      <PageHead title="Kiosks" sub="Every kiosk with its sales and print status. Open one to see all its orders and payments." />
      <Panel>
        {loading || error ? <Loading error={error} onRetry={reload} /> : (
          <Table rows={data} rowKey={(r) => r.id} empty="No kiosks yet. Add one under Printer & kiosks." cols={[
            { key: 'name', label: 'Kiosk', render: (r) => <Link className="font-semibold text-[var(--color-accent)] no-underline hover:underline" to={`/admin/kiosks/${r.code}`}>{r.name}<span className="block text-xs font-normal text-[var(--muted)]">{r.code}{r.location ? ` · ${r.location}` : ''}</span></Link> },
            { key: 'active', label: 'Status', render: (r) => <Badge tone={r.active ? 'good' : 'mute'}>{r.active ? 'active' : 'off'}</Badge> },
            { key: 'sessions_today', label: 'Sessions today' },
            { key: 'paid_orders', label: 'Paid orders' },
            { key: 'revenue_paise', label: 'Revenue', render: (r) => formatINR(r.revenue_paise ?? 0) },
            { key: 'agent', label: 'Printing', render: (r) => agentBadge(r.agent) },
          ]} />
        )}
      </Panel>
    </>
  )
}

function KioskDetail({ code }) {
  const { isAdmin } = useAdmin()
  const { data: k, loading, error, reload } = useLoad(() => adminApi.kiosk(code), [code])
  const [note, setNote] = useState(null)
  if (loading || error) return <><PageHead title="Kiosk" /><Panel><Loading error={error} onRetry={reload} /></Panel></>
  const s = k.stats
  const q = encodeURIComponent(k.code)
  return (
    <>
      <PageHead title={k.name} sub={`${k.code}${k.location ? ` · ${k.location}` : ''}`}>
        <Link to="/admin/kiosks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] no-underline"><ArrowLeft size={15} aria-hidden="true" />All kiosks</Link>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={k.active ? 'good' : 'mute'}>{k.active ? 'active' : 'switched off'}</Badge>
        {agentBadge(k.agent)}
        {k.agent?.last_seen && <span className="text-xs text-[var(--muted)]">shop PC last seen {dt(k.agent.last_seen)}</span>}
        {isAdmin && <Btn onClick={async () => { try { if (await downloadShopSetup(k)) { setNote({ tone: 'good', text: 'Setup downloaded. Unzip it on that shop’s PC and double-click install-agent.bat.' }); reload() } } catch (x) { setNote({ tone: 'bad', text: x.message }) } }}>Download setup</Btn>}
        <a className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] no-underline" href={new URL(k.url, window.location.origin).href} target="_blank" rel="noreferrer"><Monitor size={15} aria-hidden="true" />Open customer screen</a>
      </div>
      {note && <div className="mb-4"><Notice tone={note.tone}>{note.text}</Notice></div>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Revenue today" value={formatINR(s.revenue_today_paise)} sub={`${formatINR(s.revenue_7d_paise)} in 7 days`} />
        <Tile label="Revenue, all time" value={formatINR(s.revenue_total_paise)} sub={`${s.paid_orders} paid orders`} />
        <Tile label="Sessions" value={s.sessions_total} sub={`${k.sessions_today ?? 0} today`} />
        <Tile label="Orders" value={s.orders_total} sub={s.last_order_at ? `last ${dt(s.last_order_at)}` : 'none yet'} />
        <Tile label="Printed" value={s.printed} />
        <Tile label="Print failed" value={s.print_failed} sub={s.print_failed ? 'use Retry print on the order' : undefined} />
        <Tile label="Printing now" value={s.print_in_progress} />
        <Tile label="Unpaid / cancelled" value={(s.orders_by_status?.awaiting_payment ?? 0) + (s.orders_by_status?.cancelled ?? 0) + (s.orders_by_status?.expired ?? 0)} />
      </div>
      {s.print_failed > 0 && <div className="mb-4"><Notice tone="warn">{s.print_failed} paid order(s) at this kiosk failed to print. Open the order and press Retry print once the shop PC is running.</Notice></div>}
      <div className="grid gap-4 2xl:grid-cols-2">
        <Panel title="Latest orders" action={<Link className="text-sm font-semibold text-[var(--color-accent)] no-underline" to={`/admin/orders?kiosk=${q}`}>View all</Link>}>
          <Table rows={k.recent_orders} rowKey={(r) => r.reference} empty="No orders at this kiosk yet." cols={[
            { key: 'reference', label: 'Order', render: (r) => <Link className="font-semibold no-underline" to={`/admin/orders?kiosk=${q}`}>{r.reference}</Link> },
            { key: 'total_paise', label: 'Total', render: (r) => formatINR(r.total_paise) },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'print_status', label: 'Print', render: (r) => (r.print_status ? <Badge>{r.print_status}</Badge> : '—') },
            { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) },
          ]} />
        </Panel>
        <Panel title="Latest payments" action={<Link className="text-sm font-semibold text-[var(--color-accent)] no-underline" to={`/admin/payments?kiosk=${q}`}>View all</Link>}>
          <Table rows={k.recent_payments} rowKey={(r) => r.id} empty="No payments at this kiosk yet." cols={[
            { key: 'order_reference', label: 'Order', render: (r) => <span className="font-semibold">{r.order_reference}</span> },
            { key: 'amount_paise', label: 'Amount', render: (r) => formatINR(r.amount_paise) },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) },
          ]} />
        </Panel>
      </div>
    </>
  )
}

export default function Kiosks() {
  const { code } = useParams()
  return code ? <KioskDetail code={code} /> : <KioskList />
}
