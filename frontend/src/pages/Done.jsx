import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Printer, ShieldCheck, TriangleAlert } from 'lucide-react'
import Confetti from '../components/Confetti'
import CustomerLayout from '../layouts/CustomerLayout'
import Card from '../components/ui/Card'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'
import { describeSettings } from '../utils/printOptions'

const TERMINAL = ['sent', 'failed']

function PrintStatus({ print }) {
  const status = print?.status ?? 'queued'
  if (status === 'sent') {
    return (
      <Card role="status" className="mb-3 flex items-start gap-3 border-accent">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <div><b data-testid="print-status">Sent to the printer</b><p className="m-0 text-sm text-[var(--muted)]">{print.message}</p></div>
      </Card>
    )
  }
  if (status === 'failed') {
    return (
      <Card role="alert" className="mb-3 flex items-start gap-3 border-danger">
        <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
        <div><b data-testid="print-status" className="text-danger">We couldn’t print this automatically</b><p className="m-0 text-sm text-[var(--muted)]">{print.message}</p></div>
      </Card>
    )
  }
  return (
    <Card role="status" className="mb-3 flex items-start gap-3">
      <Loader2 aria-hidden="true" className="mt-0.5 shrink-0 animate-spin" />
      <div><b data-testid="print-status">Printing…</b><p className="m-0 text-sm text-[var(--muted)]">{print?.message ?? 'Preparing your pages for the printer…'}</p></div>
    </Card>
  )
}

export default function Done() {
  const { ref } = useParams()
  const { token } = useSession()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let off = false
    api.getOrder(token, ref).then((o) => !off && setOrder(o)).catch((e) => !off && setError(e.message))
    return () => { off = true }
  }, [token, ref])

  // Keep asking the server how printing is going until it reaches a final state.
  const printStatus = order?.status === 'paid' ? (order.print?.status ?? 'queued') : null
  useEffect(() => {
    if (!printStatus || TERMINAL.includes(printStatus)) return
    let off = false
    const t = setInterval(() => { api.getOrder(token, ref).then((o) => !off && setOrder(o)).catch(() => {}) }, 2000)
    return () => { off = true; clearInterval(t) }
  }, [printStatus, token, ref])

  if (error) return <CustomerLayout step={5} title="Order"><Card role="alert" className="mt-6 text-danger">{error}</Card></CustomerLayout>
  if (!order) return <CustomerLayout step={5} title="Order"><div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading order" /></CustomerLayout>
  // Confirmation is only ever shown for an order the server has verified as paid.
  if (order.status !== 'paid') return <Navigate to={`/s/${token}/pay/${ref}`} replace />

  const failed = printStatus === 'failed'
  return (
    <CustomerLayout step={5} title="Order confirmed">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          {!failed && <Confetti />}
          <div aria-hidden="true" className="mx-auto my-3 grid size-24 place-items-center rounded-full bg-gradient-to-br from-mint to-[#36d6a0] text-white shadow-[0_16px_40px_rgba(18,166,121,.4)] animate-pop">
            <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="48" className="animate-draw" /></svg>
          </div>
          <h1 className="m-0 text-xl font-bold leading-tight">{failed ? 'Paid · Printing needs help' : 'Payment received'}</h1>
          <p className="mb-4 mt-1 text-sm text-[var(--muted)]">Order <b data-testid="order-ref">{order.reference}</b></p>
        </div>
        <PrintStatus print={order.print} />
        {order.print?.status === 'sent' && (
          <p className="mb-3 mt-0 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--muted)]">
            <ShieldCheck size={14} aria-hidden="true" />
            Privacy: your files are erased from this kiosk{order.print.files_erased_at ? ` at ${new Date(order.print.files_erased_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' shortly after printing'}.
          </p>
        )}
        <div className="md:grid md:grid-cols-2 md:gap-3">
          <Card className="mb-3">
            <p className="m-0 flex items-center gap-2 truncate font-bold"><Printer aria-hidden="true" size={16} className="shrink-0" />{order.document.name}</p>
            <dl className="m-0 mt-2">
              {describeSettings(order.settings).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-[var(--border)] py-2 text-[15px] last:border-0">
                  <dt className="text-[var(--muted)]">{k}</dt><dd className="m-0 font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <QuoteCard quote={order.pricing_snapshot} />
        </div>
      </div>
    </CustomerLayout>
  )
}
