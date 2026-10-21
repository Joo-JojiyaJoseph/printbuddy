import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi } from '../adminApi'
import Modal from '../../components/ui/Modal'
import { formatINR } from '../../utils/format'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, Pager, Table, dt, inputCls, useDebounced, useLoad } from '../ui'

const STATUSES = ['draft', 'awaiting_payment', 'paid', 'cancelled', 'expired']

function Detail({ reference, onClose, onChanged }) {
  const { canOperate } = useAdmin()
  const { data: o, loading, error, reload } = useLoad(() => adminApi.order(reference), [reference])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const act = async (name, fn, ok) => {
    setBusy(name); setMsg(null)
    try { await fn(); setMsg({ tone: 'good', text: ok }); reload(); onChanged() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy('') }
  }
  const rows = o && [
    ['Status', <Badge key="s">{o.status}</Badge>], ['Total', formatINR(o.total_paise)], ['File', o.document_name], ['Kiosk', o.kiosk],
    ['Pages × copies', `${o.pages ?? '—'} × ${o.copies ?? '—'}`], ['Paper / colour', `${o.settings?.paper_size ?? '—'} / ${o.settings?.color_mode === 'color' ? 'colour' : 'black & white'}`],
    ['Layout', `${o.settings?.pages_per_sheet ?? 1} per sheet${o.settings?.duplex ? ', double-sided' : ''}`],
    ['Print', o.print_status ? <Badge key="p">{o.print_status}</Badge> : '—'], ['Created', dt(o.created_at)], ['Paid', dt(o.paid_at)],
  ]
  return (
    <Modal open onClose={onClose} title={`Order ${reference}`} size="lg">
      {loading || error ? <Loading error={error} onRetry={reload} /> : (
        <div className="mt-3 grid gap-3">
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-[var(--muted)]">{k}</dt><dd className="m-0 font-medium [overflow-wrap:anywhere]">{v}</dd></div>)}
          </dl>
          {o.print_failure && <Notice tone="bad">{o.print_failure}</Notice>}
          {o.payments?.length > 0 && (
            <div><p className="m-0 mb-1 text-xs font-semibold text-[var(--muted)]">Payments</p>
              {o.payments.map((p) => <p key={p.id} className="m-0 flex flex-wrap items-center gap-2 text-sm"><Badge>{p.status}</Badge>{formatINR(p.amount_paise)} · {p.provider} · {dt(p.verified_at || p.created_at)}</p>)}
            </div>
          )}
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          {canOperate && (
            <div className="flex flex-wrap gap-2">
              {o.print_status === 'failed' && <Btn variant="solid" loading={busy === 'retry'} onClick={() => act('retry', () => adminApi.retryPrint(reference), 'Sent to the printer again.')}>Retry print</Btn>}
              {o.status === 'awaiting_payment' && <Btn variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', () => adminApi.cancelOrder(reference), 'Order cancelled.')}>Cancel order</Btn>}
              {o.status === 'paid' && o.print_status !== 'failed' && <p className="m-0 self-center text-xs text-[var(--muted)]">Paid orders can’t be changed. Retry is offered only if printing failed.</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function Orders() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(sp.get('status') || '')
  const [kiosk, setKiosk] = useState(sp.get('kiosk') || '')
  const kiosks = useLoad(() => adminApi.kiosks())
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(null)
  const dq = useDebounced(q)
  const list = useLoad(() => adminApi.orders({ q: dq, status, kiosk, page, per_page: 12 }), [dq, status, kiosk, page])
  return (
    <>
      <PageHead title="Orders" sub="Every print order, newest first. Click a row for details." />
      <Panel>
        <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <Field label="Search"><input className={inputCls} placeholder="Order number or file name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></Field>
          <Field label="Status">
            <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); setSp({ ...(e.target.value ? { status: e.target.value } : {}), ...(kiosk ? { kiosk } : {}) }) }}>
              <option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Kiosk">
            <select className={inputCls} value={kiosk} onChange={(e) => { setKiosk(e.target.value); setPage(1); setSp({ ...(status ? { status } : {}), ...(e.target.value ? { kiosk: e.target.value } : {}) }) }}>
              <option value="">All kiosks</option>{(kiosks.data || []).map((k) => <option key={k.code} value={k.code}>{k.name}</option>)}
            </select>
          </Field>
        </div>
        {list.loading && !list.data ? <Loading /> : list.error ? <Loading error={list.error} onRetry={list.reload} /> : (
          <>
            <Table rows={list.data.data} rowKey={(r) => r.reference} onRow={(r) => setOpen(r.reference)} empty="No orders match." cols={[
              { key: 'reference', label: 'Order', render: (r) => <span className="font-semibold">{r.reference}</span> },
              { key: 'document_name', label: 'File', render: (r) => <span className="block max-w-[16rem] truncate">{r.document_name}</span> },
              { key: 'kiosk', label: 'Kiosk' },
              { key: 'pages', label: 'Pages', render: (r) => `${r.pages ?? '—'} × ${r.copies ?? '—'}` },
              { key: 'total_paise', label: 'Total', render: (r) => formatINR(r.total_paise) },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'print_status', label: 'Print', render: (r) => (r.print_status ? <Badge>{r.print_status}</Badge> : '—') },
              { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) },
            ]} />
            <Pager meta={list.data.meta} onPage={setPage} />
          </>
        )}
      </Panel>
      {open && <Detail reference={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  )
}
