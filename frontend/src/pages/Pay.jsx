import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { useSession } from '../context/SessionContext'
import { useCountdown, mmss } from '../hooks/useCountdown'
import { api } from '../services/api'
import { formatINR } from '../utils/format'

export default function Pay() {
  const { ref } = useParams()
  const { token } = useSession()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const left = useCountdown(payment?.expires_at)

  const open = useCallback(async () => {
    setBusy(true); setError(null)
    try { setPayment((await api.createPayment(token, ref)).payment) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }, [token, ref])
  useEffect(() => { open() }, [open])

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
    <CustomerLayout step={4} title="Pay with UPI"
      footer={status !== 'succeeded' && <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>}>
      {error && <Card role="alert" className="mt-4 text-danger">{error}</Card>}
      {!payment && !error && <div className="mt-6 h-72 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Preparing payment" />}
      {payment && (
        <div className="text-center">
          <p className="mb-0 mt-3 text-sm text-[var(--muted)]">Order {ref}</p>
          <p className="m-0 text-4xl font-black tracking-tight">{formatINR(payment.amount_paise)}</p>

          {status === 'pending' && (<>
            <div className="mx-auto my-4 w-fit rounded-3xl bg-white p-3.5 animate-pulse-ring">
              <QRCodeSVG value={payment.upi_uri} size={200} level="M" fgColor="#1d1845" bgColor="#ffffff" title="UPI payment QR code" />
            </div>
            <p role="status" className="m-0 font-bold">Waiting for payment…</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Scan with any UPI app. Expires in {mmss(left)}.</p>
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
