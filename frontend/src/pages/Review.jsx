import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { PriceSlip, SettingsSlip } from '../components/OrderTicket'
import { useSession } from '../context/SessionContext'
import { useQuote } from '../hooks/useQuote'
import { api } from '../services/api'
import { formatINR } from '../utils/format'
import { outputPageCount } from '../utils/pagePlan'

export default function Review() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settingsFor } = useSession()
  const navigate = useNavigate()
  const doc = docs.find((d) => d.id === docId)
  const settings = settingsFor(doc)
  const { quote, error, loading } = useQuote(token, doc, settings, doc ? outputPageCount(doc, settings.edits) : undefined)
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
    <CustomerLayout step={3} title="Check your order" hint="Make sure everything is right, then pay."
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/edit/${doc.id}`)}>Edit</Button>
        <Button variant="pay" loading={busy} disabled={!quote || loading} onClick={pay}>{quote ? `Pay ${formatINR(quote.total_paise)}` : 'Pay'}</Button>
      </>}>
      <div className="stagger">
        <SettingsSlip name={doc.original_name} settings={settings} />
        <PriceSlip quote={quote} loading={loading} error={error} />
      </div>
      {orderError && <Card role="alert" className="mt-3 text-danger">{orderError}</Card>}
    </CustomerLayout>
  )
}
