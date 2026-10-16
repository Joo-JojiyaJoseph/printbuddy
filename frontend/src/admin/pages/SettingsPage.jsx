import { useEffect, useState } from 'react'
import { adminApi } from '../adminApi'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, inputCls, useLoad } from '../ui'

const NUM = [
  ['session_ttl_minutes', 'QR session lasts (minutes)', 2, 120], ['payment_ttl_minutes', 'Payment QR lasts (minutes)', 1, 60],
  ['document_retention_hours', 'Keep uploaded files (hours)', 1, 720], ['max_upload_mb', 'Largest upload (MB)', 1, 200],
  ['max_files', 'Files per session', 1, 50], ['max_pages', 'Pages per document', 1, 5000], ['max_copies', 'Copies per order', 1, 100],
]

export default function SettingsPage() {
  const { isAdmin } = useAdmin()
  const { data, loading, error, reload } = useLoad(() => adminApi.settings())
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (data) setF({ ...Object.fromEntries(NUM.map(([k]) => [k, String(data[k])])), allowed_types: data.allowed_types, paper_sizes: data.paper_sizes.join(', ') }) }, [data])
  if (loading || error || !f) return <><PageHead title="Settings" /><Loading error={error} onRetry={reload} /></>

  const sizes = f.paper_sizes.split(',').map((s) => s.trim()).filter(Boolean)
  const bad = NUM.some(([k, , min, max]) => !Number.isInteger(Number(f[k])) || Number(f[k]) < min || Number(f[k]) > max) || f.allowed_types.length === 0 || sizes.length === 0 || sizes.some((s) => !/^[A-Za-z0-9 ]{1,20}$/.test(s))
  const toggle = (t) => setF({ ...f, allowed_types: f.allowed_types.includes(t) ? f.allowed_types.filter((x) => x !== t) : [...f.allowed_types, t] })
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await adminApi.saveSettings({ ...Object.fromEntries(NUM.map(([k]) => [k, Number(f[k])])), allowed_types: f.allowed_types, paper_sizes: sizes })
      setMsg({ tone: 'good', text: 'Saved.' }); reload()
    } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHead title="Settings" sub="Limits and file types for customers.">{isAdmin && <Btn variant="solid" loading={busy} disabled={bad} onClick={save}>Save changes</Btn>}</PageHead>
      {!isAdmin && <div className="mb-4"><Notice>Only an admin can change settings.</Notice></div>}
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Limits">
          <div className="grid gap-3 sm:grid-cols-2">
            {NUM.map(([k, label, min, max]) => <Field key={k} label={label} hint={`${min}–${max}`}><input className={inputCls} inputMode="numeric" disabled={!isAdmin} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
          </div>
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title="Accepted file types">
            <div className="flex flex-wrap gap-2">
              {data.all_types.map((t) => (
                <label key={t} className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ${f.allowed_types.includes(t) ? 'bg-[var(--hi)] ring-[var(--color-accent)]' : 'ring-[var(--border)]'}`}>
                  <input type="checkbox" disabled={!isAdmin} checked={f.allowed_types.includes(t)} onChange={() => toggle(t)} />.{t}
                </label>
              ))}
            </div>
            {!data.conversion_available && <div className="mt-3"><Notice tone="warn">Word, Excel and PowerPoint need LibreOffice on the server, which is not available now.</Notice></div>}
          </Panel>
          <Panel title="Paper sizes"><Field label="Comma separated" hint="Each size needs a price on the Pricing page."><input className={inputCls} disabled={!isAdmin} value={f.paper_sizes} onChange={(e) => setF({ ...f, paper_sizes: e.target.value })} /></Field></Panel>
          <Panel title="Server (read only)">
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm">Payments: <Badge tone={data.payment_provider === 'fake' ? 'warn' : 'good'}>{data.payment_provider === 'fake' ? 'sandbox' : data.payment_provider}</Badge> Conversion: <Badge tone={data.conversion_available ? 'good' : 'bad'}>{data.conversion_driver}</Badge></p>
            <p className="m-0 mt-2 text-xs text-[var(--muted)]">Payment keys, the print driver and database settings live in <code>backend/.env</code> and are never shown here.</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
