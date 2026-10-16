import { useState } from 'react'
import { adminApi } from '../adminApi'
import { formatINR } from '../../utils/format'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, Pager, Table, dt, inputCls, useDebounced, useLoad } from '../ui'

export default function Payments() {
  const { canOperate } = useAdmin()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [review, setReview] = useState(false)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const dq = useDebounced(q)
  const list = useLoad(() => adminApi.payments({ q: dq, status, needs_review: review, page, per_page: 12 }), [dq, status, review, page])
  const reconcile = async (id) => {
    setBusy(id); setMsg(null)
    try { await adminApi.reconcile(id); setMsg({ tone: 'good', text: 'Checked with the payment provider.' }); list.reload() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy('') }
  }
  return (
    <>
      <PageHead title="Payments" sub="Payment status is confirmed by the server with the payment provider, never by the customer’s phone." />
      <Panel>
        <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
          <Field label="Search"><input className={inputCls} placeholder="Order number or payment id" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></Field>
          <Field label="Status"><select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All</option>{['pending', 'succeeded', 'failed', 'expired'].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={review} onChange={(e) => { setReview(e.target.checked); setPage(1) }} />Needs review</label>
        </div>
        {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        {list.loading && !list.data ? <Loading /> : list.error ? <Loading error={list.error} onRetry={list.reload} /> : (
          <>
            <Table rows={list.data.data} rowKey={(r) => r.id} empty="No payments match." cols={[
              { key: 'order_reference', label: 'Order', render: (r) => <span className="font-semibold">{r.order_reference}</span> },
              { key: 'amount_paise', label: 'Amount', render: (r) => formatINR(r.amount_paise) },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'provider', label: 'Provider', render: (r) => `${r.provider} · ${r.provider_payment_id ?? ''}` },
              { key: 'review_reason', label: 'Review', render: (r) => (r.review_reason ? <span className="block max-w-[16rem] text-red-700 [overflow-wrap:anywhere]">{r.review_reason}</span> : '—') },
              { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) },
              ...(canOperate ? [{ key: 'act', label: '', render: (r) => (r.status === 'pending' || r.review_reason) && <Btn loading={busy === r.id} onClick={() => reconcile(r.id)}>Re-check</Btn> }] : []),
            ]} />
            <Pager meta={list.data.meta} onPage={setPage} />
          </>
        )}
        <p className="m-0 mt-4 text-xs text-[var(--muted)]">“Re-check” asks the provider for the real status. There is deliberately no button to mark a payment as paid by hand.</p>
      </Panel>
    </>
  )
}
