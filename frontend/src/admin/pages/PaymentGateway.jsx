import { useEffect, useState } from 'react'
import { Copy, Dices } from 'lucide-react'
import { adminApi } from '../adminApi'
import { Badge, Btn, Field, Loading, Notice, PageHead, Panel, inputCls, useLoad } from '../ui'

const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')

export default function PaymentGateway() {
  const { data, loading, error, reload } = useLoad(() => adminApi.integrations())
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [fieldErr, setFieldErr] = useState({})
  useEffect(() => { if (data) setF({ provider: data.payment.provider, key_id: data.payment.key_id, key_secret: '', webhook_secret: '' }) }, [data])
  if (loading || error || !f) return <><PageHead title="Payment gateway" /><Loading error={error} onRetry={reload} /></>
  const p = data.payment

  const dirty = f.provider !== p.provider || f.key_id.trim() !== p.key_id || !!f.key_secret || !!f.webhook_secret
  const persist = () => adminApi.saveIntegrations({
    payment_provider: f.provider, razorpay_key_id: f.key_id.trim(),
    ...(f.key_secret && { razorpay_key_secret: f.key_secret }), ...(f.webhook_secret && { razorpay_webhook_secret: f.webhook_secret }),
  })
  const save = async () => {
    setBusy('save'); setMsg(null); setFieldErr({})
    try {
      await persist()
      setMsg({ tone: 'good', text: 'Saved. The secrets are stored encrypted and are not shown again.' }); reload()
    } catch (e) { setMsg({ tone: 'bad', text: e.message }); setFieldErr(e.errors || {}) } finally { setBusy('') }
  }
  // Test connection checks what is SAVED, so any change on the screen is saved first. Nothing is tested that was never saved.
  const test = async () => {
    setBusy('test'); setMsg(null); setFieldErr({})
    try {
      if (dirty) { try { await persist() } catch (e) { setFieldErr(e.errors || {}); throw e } }
      const r = await adminApi.testPayment()
      setMsg({ tone: 'good', text: `${dirty ? 'Saved. ' : ''}${r.message}` }); if (dirty) reload()
    } catch (e) { setMsg({ tone: 'bad', text: e.message }) } finally { setBusy('') }
  }
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => setMsg({ tone: 'good', text: `${what} copied.` })).catch(() => {})
  const razor = f.provider === 'razorpay'
  const err = (k) => fieldErr[k]?.[0] && <span className="mt-1 block text-xs text-red-700">{fieldErr[k][0]}</span>

  return (
    <>
      <PageHead title="Payment gateway" sub="Customers pay by UPI. The server confirms each payment with the gateway before printing starts.">
        <Btn variant="solid" loading={busy === 'save'} onClick={save}>Save</Btn>
      </PageHead>
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Connection" action={<Badge tone={p.from === 'admin' ? 'info' : 'mute'}>{p.from === 'admin' ? 'saved here' : 'from .env'}</Badge>}>
          <div className="grid gap-3">
            <Field label="Payment provider">
              <select className={inputCls} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
                {!p.production && <option value="fake">Sandbox (testing only, no real money)</option>}
                <option value="razorpay">Razorpay (UPI QR, confirmed automatically)</option>
              </select>
              {err('payment_provider')}
            </Field>
            {razor && (
              <>
                <Field label="Key ID" hint="Starts with rzp_test_ (testing) or rzp_live_ (real money).">
                  <input className={inputCls} autoComplete="off" spellCheck={false} placeholder="rzp_test_xxxxxxxxxx" value={f.key_id} onChange={(e) => setF({ ...f, key_id: e.target.value })} />
                  {err('razorpay_key_id')}
                </Field>
                <Field label="Key Secret" hint={p.key_secret_set ? 'A secret is saved. Leave empty to keep it, or type a new one to replace it.' : 'Not saved yet.'}>
                  <input className={inputCls} type="password" autoComplete="new-password" placeholder={p.key_secret_set ? '•••••••• saved' : ''} value={f.key_secret} onChange={(e) => setF({ ...f, key_secret: e.target.value })} />
                  {err('razorpay_key_secret')}
                </Field>
                <Field label="Webhook secret (optional)" hint={p.webhook_secret_set ? 'Saved. Leave empty to keep it.' : 'Only needed if you add the webhook in Razorpay. Choose any long random text (16+ characters), or press Generate, and paste the same text in Razorpay.'}>
                  <div className="flex gap-2">
                    <input className={inputCls} type="text" autoComplete="off" spellCheck={false} placeholder={p.webhook_secret_set ? '•••••••• saved' : ''} value={f.webhook_secret} onChange={(e) => setF({ ...f, webhook_secret: e.target.value })} />
                    <Btn aria-label="Generate a random webhook secret" onClick={() => setF({ ...f, webhook_secret: randomSecret() })}><Dices size={15} aria-hidden="true" />Generate</Btn>
                  </div>
                  {err('razorpay_webhook_secret')}
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn loading={busy === 'test'} onClick={test}>Test connection</Btn>
                  {p.mode && <Badge tone={p.mode === 'live' ? 'good' : 'warn'}>{p.mode === 'live' ? 'live keys: real money' : 'test keys: no real money'}</Badge>}
                  <span className="text-xs text-[var(--muted)]">Any change you made is saved first, then tested.</span>
                </div>
              </>
            )}
            {!razor && <Notice tone="warn">Sandbox mode shows a fake QR and a “Customer pays” button. No real money is taken. Use it only while testing.</Notice>}
          </div>
        </Panel>

        <div className="grid content-start gap-4">
          <Panel title="Webhook (recommended)">
            <p className="m-0 mb-3 text-sm text-[var(--muted)]">In Razorpay: Dashboard → Webhooks → Add. It needs a public https address. Without one, the customer’s screen still checks with Razorpay every few seconds.</p>
            <Field label="Webhook URL"><div className="flex gap-2"><input readOnly className={`${inputCls} bg-[var(--hi)]`} value={p.webhook_url} /><Btn aria-label="Copy webhook URL" onClick={() => copy(p.webhook_url, 'Webhook URL')}><Copy size={14} /></Btn></div></Field>
            <Field className="mt-3" label="Event to tick"><input readOnly className={`${inputCls} bg-[var(--hi)]`} value={p.webhook_event} /></Field>
          </Panel>
          <Panel title="Setup steps">
            <ol className="m-0 grid list-decimal gap-1.5 pl-5 text-sm">
              <li>Create a Razorpay account and finish KYC.</li>
              <li>Add your bank account in Razorpay. Payments settle there.</li>
              <li>Razorpay → API keys → generate. Paste Key ID and Key Secret here.</li>
              <li>Ask Razorpay support to enable <b>QR Codes</b> if needed.</li>
              <li>Save, then press <b>Test connection</b>.</li>
              <li>Switch from test keys to live keys, then make one small real payment.</li>
            </ol>
          </Panel>
        </div>
      </div>
      <p className="m-0 mt-4 text-xs text-[var(--muted)]">Secrets are encrypted before they are stored and are never sent back to this page. Values left empty fall back to <code>backend/.env</code>.</p>
    </>
  )
}
