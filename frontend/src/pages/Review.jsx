import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { useQuote } from '../hooks/useQuote'
import { describeSettings } from '../utils/printOptions'
import { api } from '../services/api'
import { formatINR } from '../utils/format'

export default function Review() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settings } = useSession()
  const navigate = useNavigate()
  const doc = docs.find((d) => d.id === docId)
  const { quote, error, loading } = useQuote(token, doc, settings)
  const [busy, setBusy] = useState(false)
  const [orderError, setOrderError] = useState(null)

  // The server re-prices when the order is created; the amount shown here is never submitted.
  const pay = async () => {
    setBusy(true); setOrderError(null)
    try {
      const order = await api.createOrder(token, { document_id: doc.id, settings })
      navigate(`/s/${token}/pay/${order.reference}`)
    } catch (e) { setOrderError(e.message); setBusy(false) }
  }

  if (docsLoaded && (!doc || doc.status !== 'ready')) return <Navigate to={`/s/${token}/upload`} replace />
  if (!doc) return null
  return (
    <CustomerLayout step={3} title="Review"
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/configure/${doc.id}`)}>Edit</Button>
        <Button loading={busy} disabled={!quote || loading} onClick={pay}>{quote ? `Pay ${formatINR(quote.total_paise)}` : 'Pay'}</Button>
      </>}>
      <h1 className="mb-3 mt-2 text-[27px] font-extrabold leading-tight tracking-tight">Check your order</h1>
      <Card className="mb-3">
        <p className="m-0 truncate font-bold">{doc.original_name}</p>
        <dl className="m-0 mt-2">
          {describeSettings(settings).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-[var(--border)] py-2 text-[15px] last:border-0">
              <dt className="text-[var(--muted)]">{k}</dt><dd className="m-0 font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <QuoteCard quote={quote} loading={loading} error={error} />
      {orderError && <Card role="alert" className="mt-3 text-danger">{orderError}</Card>}
    </CustomerLayout>
  )
}
