import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import Confetti from '../components/Confetti'
import PrintArt from '../components/PrintArt'
import CustomerLayout from '../layouts/CustomerLayout'
import Card from '../components/ui/Card'
import { PriceSlip, SettingsSlip } from '../components/OrderTicket'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'

const TERMINAL = ['sent', 'failed']

function PrintStatus({ print }) {
  const status = print?.status ?? 'queued'
  if (status === 'sent') {
    return (
      <Card role="status" className="mb-4 flex animate-pop items-start gap-3 border-accent">
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

/** A glossy mint sphere with a drawn tick, rings that ripple out, and a few sparkles. Shown once the server has verified the payment. */
function SuccessBadge() {
  return (
    <div className="relative mx-auto grid size-32 place-items-center" aria-hidden="true">
      {[0, 0.6, 1.2].map((d) => <span key={d} className="absolute inset-0 animate-ripple rounded-full border-2 border-[#6ee7b7]" style={{ animationDelay: `${d}s` }} />)}
      <span className="animate-pop relative grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_26%,#d9fff0_0_8%,#6ee7b7_30%,#12b886_70%,#0b7a5c_100%)] shadow-[inset_-8px_-12px_22px_rgba(6,70,50,.35),inset_0_3px_3px_rgba(255,255,255,.6),0_22px_30px_-10px_rgba(11,122,92,.55)]">
        <svg viewBox="0 0 24 24" className="size-12 drop-shadow-[0_3px_2px_rgba(6,70,50,.4)]" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="48" className="animate-draw" /></svg>
      </span>
      <i className="absolute -right-1 top-2 size-3 animate-twinkle rounded-full bg-[#ffb3c8]" />
      <i className="absolute -left-2 top-10 size-2.5 animate-twinkle rounded-full bg-[#9a80ff] [animation-delay:-.8s]" />
      <i className="absolute bottom-1 right-0 size-2 animate-twinkle rounded-full bg-[#ffd36e] [animation-delay:-1.5s]" />
    </div>
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
          {printStatus === 'sent' && <Confetti />}
          <SuccessBadge />
          <h1 className="m-0 mt-2 animate-rise text-[1.625rem] font-extrabold leading-tight tracking-tight md:text-3xl">{failed ? 'Payment successful · Printing needs help' : 'Payment successful'}</h1>
          <p className="mb-3 mt-2 animate-rise [animation-delay:.1s]"><span className="clay inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-[var(--muted)]">Order <b data-testid="order-ref" className="tracking-wide text-[var(--text)]">{order.reference}</b></span></p>
          <div className="mb-2"><PrintArt state={failed ? 'failed' : printStatus === 'sent' ? 'sent' : 'printing'} /></div>
        </div>
        <PrintStatus print={order.print} />
        {order.print?.status === 'sent' && (
          <p className="mb-3 mt-0 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--muted)]">
            <ShieldCheck size={14} aria-hidden="true" />
            Privacy: your files are erased from this kiosk{order.print.files_erased_at ? ` at ${new Date(order.print.files_erased_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' shortly after printing'}.
          </p>
        )}
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
          <SettingsSlip name={order.document.name} settings={order.settings} />
          <div className="mt-4 md:mt-0 [&>div]:mt-0"><PriceSlip quote={order.pricing_snapshot} /></div>
        </div>
      </div>
    </CustomerLayout>
  )
}
