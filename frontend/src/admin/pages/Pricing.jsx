import { useEffect, useState } from 'react'
import { adminApi } from '../adminApi'
import { useAdmin } from '../AdminApp'
import { Btn, Field, Loading, Notice, PageHead, Panel, inputCls, useLoad } from '../ui'

const rupees = (paise) => (paise / 100).toFixed(2)
const toPaise = (v) => Math.round(Number(v) * 100)

export default function Pricing() {
  const { isAdmin } = useAdmin()
  const { data, loading, error, reload } = useLoad(() => adminApi.pricing())
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    if (data) setF({ rates: data.rates.map((r) => ({ ...r, price: rupees(r.per_side_paise) })), duplex: String(data.duplex_discount_bps / 100), fee: rupees(data.service_fee_paise), tax: String(data.tax_bps / 100) })
  }, [data])
  if (loading || error || !f) return <><PageHead title="Pricing" /><Loading error={error} onRetry={reload} /></>

  const setRate = (i, patch) => setF({ ...f, rates: f.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const invalid = f.rates.some((r) => !(Number(r.price) >= 0.01)) || !(Number(f.duplex) >= 0 && Number(f.duplex) <= 100) || !(Number(f.fee) >= 0) || !(Number(f.tax) >= 0 && Number(f.tax) <= 100)
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await adminApi.savePricing({
        rates: f.rates.map((r) => ({ paper_size: r.paper_size, color_mode: r.color_mode, per_side_paise: toPaise(r.price), active: r.active })),
        duplex_discount_bps: Math.round(Number(f.duplex) * 100), service_fee_paise: toPaise(f.fee), tax_bps: Math.round(Number(f.tax) * 100),
      })
      setMsg({ tone: 'good', text: 'Saved. New orders use these prices straight away; orders already created keep the price shown to the customer.' }); reload()
    } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHead title="Pricing" sub="Prices are applied by the server. Customers can’t change them.">
        {isAdmin && <Btn variant="solid" loading={busy} disabled={invalid} onClick={save}>Save changes</Btn>}
      </PageHead>
      {!isAdmin && <div className="mb-4"><Notice>Only an admin can change prices.</Notice></div>}
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Price per printed side (₹)">
          <div className="grid gap-2">
            {f.rates.map((r, i) => (
              <div key={`${r.paper_size}-${r.color_mode}`} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-3 rounded-xl bg-[var(--hi)] px-3 py-2">
                <span className="text-sm font-semibold">{r.paper_size} · {r.color_mode === 'color' ? 'Colour' : 'Black & white'}</span>
                <input className={inputCls} aria-label={`${r.paper_size} ${r.color_mode} price`} inputMode="decimal" disabled={!isAdmin} value={r.price} onChange={(e) => setRate(i, { price: e.target.value })} />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={!isAdmin} checked={r.active !== false} onChange={(e) => setRate(i, { active: e.target.checked })} />On</label>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Discounts and extras">
          <div className="grid gap-3">
            <Field label="Double-sided discount (%)" hint="Taken off each side when printing both sides."><input className={inputCls} inputMode="decimal" disabled={!isAdmin} value={f.duplex} onChange={(e) => setF({ ...f, duplex: e.target.value })} /></Field>
            <Field label="Service fee per order (₹)"><input className={inputCls} inputMode="decimal" disabled={!isAdmin} value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} /></Field>
            <Field label="Tax (%)" hint="Charged on the total of printing plus service fee."><input className={inputCls} inputMode="decimal" disabled={!isAdmin} value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} /></Field>
          </div>
          <p className="m-0 mt-3 text-xs text-[var(--muted)]">{data.billing_policy}. “Pages per sheet” is billed per printed side, so 2-up costs half.</p>
        </Panel>
      </div>
    </>
  )
}
