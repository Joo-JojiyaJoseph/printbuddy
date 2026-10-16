import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, ScanLine, XCircle } from 'lucide-react'
import { adminApi } from '../adminApi'
import { useAdmin } from '../AdminApp'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, Table, inputCls, useLoad, dt } from '../ui'

function Check({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon size={16} className={`mt-0.5 shrink-0 ${ok ? 'text-emerald-600' : 'text-red-600'}`} aria-hidden="true" />
      <span className="min-w-0"><span className="font-semibold">{label}</span>{detail && <span className="block text-xs text-[var(--muted)] [overflow-wrap:anywhere]">{detail}</span>}</span>
    </li>
  )
}

function PrinterPanel() {
  const { canOperate, isAdmin } = useAdmin()
  const { data: p, loading, error, reload } = useLoad(() => adminApi.printer())
  const [choice, setChoice] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  if (loading || error) return <Panel title="Printer"><Loading error={error} onRetry={reload} /></Panel>
  const value = choice ?? p.printer ?? ''
  const run = async (name, fn, okText) => {
    setBusy(name); setMsg(null)
    try { const r = await fn(); setMsg({ tone: 'good', text: okText(r) }); setChoice(null); reload() } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy('') }
  }
  return (
    <Panel title="Printer connection" action={<Badge tone={p.production_ready ? 'good' : 'warn'}>{p.production_ready ? `driver: ${p.driver}` : 'development driver'}</Badge>}>
      {!p.production_ready && <div className="mb-3"><Notice tone="warn">The server is saving PDFs to a folder instead of printing. Under <b>Connection settings</b> choose <b>SumatraPDF</b> (Windows) or <b>CUPS</b> (Linux/macOS) to print for real.</Notice></div>}
      <ul className="m-0 mb-4 grid list-none gap-2.5 p-0">
        <Check ok={p.driver_available} label="Print program found" detail={p.driver_available ? `Driver “${p.driver}” is ready.` : 'Not found on the server computer. Install it, then paste its full path under Connection settings.'} />
        <Check ok={p.poppler_available} label="Poppler (page rendering) found" detail={p.poppler_available ? undefined : 'Not found. Install Poppler, then paste the path to pdftoppm under Connection settings. Needed for edited pages and pages per sheet.'} />
        <Check ok={p.printer_found} label={p.printer ? `Printer “${p.printer}” is installed` : 'Using the system default printer'} detail={p.installed_error || (p.printer_from === 'env' ? 'Name comes from PRINTER_NAME in .env' : p.printer_from === 'admin' ? 'Chosen here in the admin panel' : undefined)} />
      </ul>
      <Field label="Printer to use" hint={p.installed_printers.length ? 'Printers installed on the server computer. Leave empty for the system default.' : 'No printers were detected. You can still type a name exactly as the system shows it.'}>
        <div className="flex gap-2">
          <input className={inputCls} list="printers" value={value} disabled={!isAdmin} onChange={(e) => setChoice(e.target.value)} placeholder="System default" />
          <datalist id="printers">{p.installed_printers.map((n) => <option key={n} value={n} />)}</datalist>
          {isAdmin && <Btn variant="solid" loading={busy === 'save'} disabled={choice === null} onClick={() => run('save', () => adminApi.selectPrinter(value.trim()), () => 'Printer saved.')}>Save</Btn>}
        </div>
      </Field>
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {canOperate && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Btn variant="solid" loading={busy === 'test'} onClick={() => run('test', () => adminApi.testPrinter(), (r) => r.note)}>Print test page</Btn>
          <span className="text-xs text-[var(--muted)]">Prints one page with the same settings as real orders.</span>
        </div>
      )}
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[['Sent (24h)', p.jobs_24h.sent], ['Failed (24h)', p.jobs_24h.failed], ['In progress', p.jobs_24h.in_progress]].map(([l, n]) => (
          <div key={l} className="rounded-xl bg-[var(--hi)] p-2.5"><p className="m-0 text-lg font-bold">{n}</p><p className="m-0 text-xs text-[var(--muted)]">{l}</p></div>
        ))}
      </div>
      {p.recent_failures.length > 0 && (
        <div className="mt-4"><p className="m-0 mb-1 text-xs font-semibold text-[var(--muted)]">Recent failures</p>
          {p.recent_failures.map((f, i) => <p key={i} className="m-0 text-sm [overflow-wrap:anywhere]"><b>{f.reference}</b> · {f.reason} <span className="text-xs text-[var(--muted)]">{dt(f.at)}</span></p>)}
        </div>
      )}
      <p className="m-0 mt-4 text-xs text-[var(--muted)]">“Sent” means the print system accepted the job. Paper jams, empty trays and an offline printer are not detected.</p>
    </Panel>
  )
}

function ConnectionPanel({ onSaved }) {
  const { data, loading, error, reload } = useLoad(() => adminApi.integrations())
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fieldErr, setFieldErr] = useState({})
  useEffect(() => { if (data) setF({ print_driver: data.printing.driver, sumatra_path: data.printing.sumatra_path, lp_path: data.printing.lp_path, pdftoppm_path: data.printing.pdftoppm_path }) }, [data])
  if (loading || error || !f) return <Panel title="Connection settings"><Loading error={error} onRetry={reload} /></Panel>
  const pr = data.printing
  const save = async () => {
    setBusy(true); setMsg(null); setFieldErr({})
    try { await adminApi.saveIntegrations(f); setMsg({ tone: 'good', text: 'Saved.' }); reload(); onSaved() } catch (e) { setMsg({ tone: 'bad', text: e.message }); setFieldErr(e.errors || {}) } finally { setBusy(false) }
  }
  const path = (k, label, found, hint) => (
    <Field label={label} hint={found ? `Found: ${found}` : hint}>
      <input className={inputCls} spellCheck={false} value={f[k]} placeholder="Leave empty to find it automatically" onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {fieldErr[k]?.[0] && <span className="mt-1 block text-xs text-red-700">{fieldErr[k][0]}</span>}
    </Field>
  )
  return (
    <Panel title="Connection settings" action={<Badge tone={pr.from === 'admin' ? 'info' : 'mute'}>{pr.from === 'admin' ? 'saved here' : 'from .env'}</Badge>}>
      <div className="grid gap-3">
        <Field label="How the server prints" hint={pr.os === 'Windows' ? 'On Windows choose SumatraPDF.' : 'On Linux or macOS choose CUPS.'}>
          <select className={inputCls} value={f.print_driver} onChange={(e) => setF({ ...f, print_driver: e.target.value })}>
            {!pr.production && <option value="file">Save PDFs to a folder (testing, nothing prints)</option>}
            <option value="sumatra">SumatraPDF (Windows)</option>
            <option value="cups">CUPS “lp” (Linux / macOS)</option>
          </select>
          {fieldErr.print_driver?.[0] && <span className="mt-1 block text-xs text-red-700">{fieldErr.print_driver[0]}</span>}
        </Field>
        {f.print_driver === 'sumatra' && path('sumatra_path', 'SumatraPDF.exe location', pr.detected.sumatra, 'Install SumatraPDF, then paste the full path to SumatraPDF.exe.')}
        {f.print_driver === 'cups' && path('lp_path', 'lp command location', pr.detected.lp, 'Usually /usr/bin/lp.')}
        {path('pdftoppm_path', 'Poppler (pdftoppm) location', pr.detected.pdftoppm, 'Needed for edited pages and several pages per sheet. Install Poppler and paste the path to pdftoppm.')}
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <div><Btn variant="solid" loading={busy} onClick={save}>Save connection settings</Btn></div>
        <p className="m-0 text-xs text-[var(--muted)]">Only the expected program is accepted for each path. Pick the printer itself above.</p>
      </div>
    </Panel>
  )
}

function ScannerPanel() {
  return (
    <Panel title="Scanner" action={<ScanLine size={18} className="text-[var(--color-accent)]" aria-hidden="true" />}>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        <Check ok label="Phone-camera scan" detail="Customers photograph a page on their phone and upload it. Nothing to connect." />
        <Check ok={false} label="USB / network scanner" detail="Needs a small program on the shop computer (WIA/SANE) to hand scans to the website. Not part of this build." />
      </ul>
    </Panel>
  )
}

function Kiosks() {
  const { isAdmin } = useAdmin()
  const { data, loading, error, reload } = useLoad(() => adminApi.kiosks())
  const [form, setForm] = useState({ code: '', name: '', location: '' })
  const [msg, setMsg] = useState(null)
  const add = async (e) => {
    e.preventDefault(); setMsg(null)
    try { await adminApi.createKiosk(form); setForm({ code: '', name: '', location: '' }); setMsg({ tone: 'good', text: 'Kiosk added.' }); reload() } catch (x) { setMsg({ tone: 'bad', text: x.message }) }
  }
  const toggle = async (k) => { try { await adminApi.updateKiosk(k.id, { active: !k.active }); reload() } catch (x) { setMsg({ tone: 'bad', text: x.message }) } }
  const copy = (k) => navigator.clipboard?.writeText(new URL(k.url, window.location.origin).href).then(() => setMsg({ tone: 'good', text: 'Kiosk link copied. Open it full-screen on that kiosk’s screen.' })).catch(() => {})
  return (
    <Panel title="Kiosks">
      {loading || error ? <Loading error={error} onRetry={reload} /> : (
        <Table rows={data} rowKey={(r) => r.id} cols={[
          { key: 'name', label: 'Kiosk', render: (r) => <><span className="font-semibold">{r.name}</span><span className="block text-xs text-[var(--muted)]">{r.code}{r.location ? ` · ${r.location}` : ''}</span></> },
          { key: 'active', label: 'Status', render: (r) => <Badge tone={r.active ? 'good' : 'mute'}>{r.active ? 'active' : 'off'}</Badge> },
          { key: 'sessions_today', label: 'Today' },
          { key: 'act', label: '', render: (r) => <span className="flex gap-1.5"><Btn aria-label={`Copy link for ${r.name}`} onClick={() => copy(r)}><Copy size={14} />Link</Btn>{isAdmin && <Btn onClick={() => toggle(r)}>{r.active ? 'Switch off' : 'Switch on'}</Btn>}</span> },
        ]} />
      )}
      {msg && <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {isAdmin && (
        <form onSubmit={add} className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Code (letters, digits, - _)"><input className={inputCls} required pattern="[A-Za-z0-9_\-]+" maxLength={40} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Name"><input className={inputCls} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Location"><input className={inputCls} maxLength={160} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Btn variant="solid" type="submit">Add kiosk</Btn>
        </form>
      )}
    </Panel>
  )
}

export default function Devices() {
  const { isAdmin } = useAdmin()
  const [v, setV] = useState(0) // bumps after connection settings are saved so the status panel re-checks
  return (
    <>
      <PageHead title="Printer & kiosks" sub="Check the connection to the printer, and manage the kiosk screens." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PrinterPanel key={v} />
        <div className="grid content-start gap-4">{isAdmin && <ConnectionPanel onSaved={() => setV((n) => n + 1)} />}<ScannerPanel /></div>
      </div>
      <div className="mt-4"><Kiosks /></div>
    </>
  )
}
