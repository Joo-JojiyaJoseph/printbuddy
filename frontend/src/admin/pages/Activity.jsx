import { useState } from 'react'
import { adminApi } from '../adminApi'
import { Field, Loading, PageHead, Panel, Pager, Table, dt, inputCls, useDebounced, useLoad } from '../ui'

export default function Activity() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const dq = useDebounced(q)
  const list = useLoad(() => adminApi.audit({ q: dq, page, per_page: 20 }), [dq, page])
  return (
    <>
      <PageHead title="Activity log" sub="Who changed what. Passwords, tokens and payment keys are never recorded." />
      <Panel>
        <div className="mb-3 max-w-xs"><Field label="Filter by action"><input className={inputCls} placeholder="e.g. pricing, printer, user" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></Field></div>
        {list.loading && !list.data ? <Loading /> : list.error ? <Loading error={list.error} onRetry={list.reload} /> : (
          <>
            <Table rows={list.data.data} rowKey={(r) => r.id} empty="No activity yet." cols={[
              { key: 'created_at', label: 'When', render: (r) => dt(r.created_at) },
              { key: 'user', label: 'Who', render: (r) => r.user ?? 'System' },
              { key: 'action', label: 'Action', render: (r) => <span className="font-semibold">{r.action}</span> },
              { key: 'subject', label: 'About' },
              { key: 'meta', label: 'Details', render: (r) => (r.meta ? <code className="block max-w-[22rem] truncate text-xs">{JSON.stringify(r.meta)}</code> : '—') },
            ]} />
            <Pager meta={list.data.meta} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  )
}
