import { useState } from 'react'
import { adminApi } from '../adminApi'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, Pager, Table, dt, inputCls, useLoad } from '../ui'

export default function Sessions() {
  const { canOperate } = useAdmin()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [msg, setMsg] = useState(null)
  const list = useLoad(() => adminApi.sessions({ status, page, per_page: 12 }), [status, page])
  const revoke = async (id) => {
    try { await adminApi.revokeSession(id); setMsg({ tone: 'good', text: 'Session ended. That phone can no longer use the kiosk.' }); list.reload() } catch (e) { setMsg({ tone: 'bad', text: e.message }) }
  }
  return (
    <>
      <PageHead title="QR sessions" sub="Each scan of a kiosk QR code is one session, tied to one phone." />
      <Panel>
        <div className="mb-3 max-w-[12rem]"><Field label="Status"><select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All</option>{['waiting', 'active', 'completed', 'expired', 'cancelled'].map((s) => <option key={s}>{s}</option>)}</select></Field></div>
        {msg && <div className="mb-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        {list.loading && !list.data ? <Loading /> : list.error ? <Loading error={list.error} onRetry={list.reload} /> : (
          <>
            <Table rows={list.data.data} rowKey={(r) => r.id} empty="No sessions." cols={[
              { key: 'kiosk', label: 'Kiosk', render: (r) => <span className="font-semibold">{r.kiosk_name || r.kiosk}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'documents_count', label: 'Files' }, { key: 'orders_count', label: 'Orders' },
              { key: 'created_at', label: 'Started', render: (r) => dt(r.created_at) },
              { key: 'expires_at', label: 'Expires', render: (r) => dt(r.expires_at) },
              ...(canOperate ? [{ key: 'act', label: '', render: (r) => ['active', 'waiting'].includes(r.status) && <Btn variant="danger" onClick={() => revoke(r.id)}>End session</Btn> }] : []),
            ]} />
            <Pager meta={list.data.meta} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  )
}
