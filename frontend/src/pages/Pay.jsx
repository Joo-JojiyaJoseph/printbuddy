import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useSession } from '../context/SessionContext'
import { useCountdown, mmss } from '../hooks/useCountdown'
import { api } from '../services/api'
import { formatINR } from '../utils/format'
import { upiLinks, canOpenUpiApps } from '../utils/upi'

export default function Pay() {
  const { ref } = useParams()
  const { token } = useSession()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [launched, setLaunched] = useState(false)
  const left = useCountdown(payment?.expires_at)
  const links = upiLinks(payment?.upi_uri)
  const phone = canOpenUpiApps()

  const open = useCallback(async () => {
    setBusy(true); setError(null); setLaunched(false)
    try { setPayment((await api.createPayment(token, ref)).payment) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }, [token, ref])
  useEffect(() => { open() }, [open])

  // The page keeps asking the SERVER whether the payment is verified; opening a UPI app proves nothing.
  const status = payment?.status
  useEffect(() => {
    if (status !== 'pending') return
    const t = setInterval(async () => {
      try { setPayment((await api.getPayment(token, ref)).payment) } catch { /* keep polling */ }
    }, 1500)
    return () => clearInterval(t)
  }, [status, token, ref])

  useEffect(() => { if (status === 'succeeded') navigate(`/s/${token}/done/${ref}`, { replace: true }) }, [status, token, ref, navigate])

  const sb = api.sandbox
  const act = async (fn) => { fn(); try { setPayment((await api.getPayment(token, ref)).payment) } catch (e) { setError(e.message) } }

  return (
    <CustomerLayout step={4} title="Pay with UPI" hint="Tap your UPI app, or scan the code with any UPI app."
      footer={status !== 'succeeded' && <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>}>
      {error && <Card role="alert" className="mt-4 text-danger">{error}</Card>}
      {!payment && !error && <div className="mt-6 h-72 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Preparing payment" />}
      {payment && (
        <div className="mx-auto max-w-md text-center">
          <p className="mb-0 mt-3 text-sm text-[var(--muted)]">Order {ref}</p>
          <p className="m-0 text-3xl font-bold tracking-tight md:text-4xl">{formatINR(payment.amount_paise)}</p>

          {status === 'pending' && (<>
            {links ? (
              <div className="mt-5">
                <a href={links.any} onClick={() => setLaunched(true)}
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-gradient-to-r from-coral-deep to-[#E24A26] px-5 text-base font-bold text-white shadow-[0_10px_26px_rgba(214,64,31,.35)] active:scale-95">
                  <Smartphone aria-hidden="true" size={20} /> Pay now
                </a>
                <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Or choose your UPI app</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {links.apps.map((a) => (
                    <a key={a.id} href={a.href} onClick={() => setLaunched(true)}
                      className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 text-[15px] font-bold active:scale-95">
                      {a.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              // Provider gave a non-UPI payload (hosted QR): nothing to deep-link, so the QR is the only way to pay.
              <div className="mx-auto my-4 w-fit rounded-3xl bg-white p-3.5">
                {payment.qr_image_url
                  ? <img src={payment.qr_image_url} alt="UPI payment QR code" width={220} height={220} className="block size-[220px] object-contain" />
                  : <QRCodeSVG value={payment.upi_uri ?? ''} size={200} level="M" fgColor="#10242B" bgColor="#ffffff" title="UPI payment QR code" />}
              </div>
            )}

            <p role="status" className="mb-0 mt-5 font-bold">{launched ? 'Finish paying in your UPI app, then come back here…' : 'Waiting for payment…'}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">This page confirms automatically once your bank confirms the payment. Expires in {mmss(left)}.</p>

            {links && (
              <div className="mt-5 border-t border-dashed border-[var(--border)] pt-4">
                <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Or scan this QR code with any UPI app</p>
                <div className="mx-auto w-fit rounded-3xl bg-white p-3.5">
                  <QRCodeSVG value={payment.upi_uri} size={192} level="M" fgColor="#10242B" bgColor="#ffffff" title="UPI payment QR code" />
                </div>
                {!phone && <p className="mb-0 mt-2 text-sm text-[var(--muted)]">On a computer, scan this with your phone’s UPI app.</p>}
              </div>
            )}
          </>)}
          {status === 'failed' && <Card role="alert" className="mt-4"><b className="text-danger">Payment failed.</b><p className="mb-3 text-sm text-[var(--muted)]">You have not been charged for this order.</p><div className="flex"><Button loading={busy} onClick={open}>Try again</Button></div></Card>}
          {status === 'expired' && <Card role="alert" className="mt-4"><b className="text-amber">Payment expired.</b><p className="mb-3 text-sm text-[var(--muted)]">Start a new payment to continue.</p><div className="flex"><Button loading={busy} onClick={open}>New payment</Button></div></Card>}

          {sb && status !== 'succeeded' && (
            <Card className="mt-4 text-left">
              <p className="m-0 text-xs font-bold text-amber">SANDBOX ONLY: simulates what your bank does. The order is still marked paid only after server-side verification.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                <button type="button" className="min-h-11 rounded-xl border border-[var(--border)]" onClick={() => act(() => sb.customerPays(ref))}>Customer pays</button>
                <button type="button" className="min-h-11 rounded-xl border border-[var(--border)]" onClick={() => act(() => sb.customerPays(ref, { fail: true }))}>Payment fails</button>
                <button type="button" className="min-h-11 rounded-xl border border-[var(--border)]" onClick={() => act(() => sb.customerPays(ref, { amountPaise: 100 }))}>Underpays ₹1</button>
                <button type="button" className="min-h-11 rounded-xl border border-[var(--border)]" onClick={() => act(() => sb.expire(ref))}>Let it expire</button>
              </div>
            </Card>
          )}
        </div>
      )}
    </CustomerLayout>
  )
}
