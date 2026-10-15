import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Card from '../components/ui/Card'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'
import { describeSettings } from '../utils/printOptions'

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

  if (error) return <CustomerLayout step={5} title="Order"><Card role="alert" className="mt-6 text-danger">{error}</Card></CustomerLayout>
  if (!order) return <CustomerLayout step={5} title="Order"><div className="mt-6 h-48 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading order" /></CustomerLayout>
  // Confirmation is only ever shown for an order the server has verified as paid.
  if (order.status !== 'paid') return <Navigate to={`/s/${token}/pay/${ref}`} replace />

  return (
    <CustomerLayout step={5} title="Order confirmed">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto my-3 w-fit -rotate-6 rounded-2xl border-[6px] border-accent px-5 py-1 text-3xl font-black text-accent">PAID</div>
        <h1 className="m-0 text-2xl font-extrabold leading-tight">Paid · Ready for Future Printing</h1>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">Order <b data-testid="order-ref">{order.reference}</b>. Printing is not connected yet, so nothing has been sent to a printer.</p>
      </div>
      <Card className="mb-3">
        <p className="m-0 truncate font-bold">{order.document.name}</p>
        <dl className="m-0 mt-2">
          {describeSettings(order.settings).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-[var(--border)] py-2 text-[15px] last:border-0">
              <dt className="text-[var(--muted)]">{k}</dt><dd className="m-0 font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <QuoteCard quote={order.pricing_snapshot} />
    </CustomerLayout>
  )
}
