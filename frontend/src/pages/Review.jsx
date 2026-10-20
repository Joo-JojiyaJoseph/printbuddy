import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { useQuote } from '../hooks/useQuote'
import { describeSettings } from '../utils/printOptions'
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
        <div className="mb-3 rounded-[22px] border border-[var(--border)] bg-white p-3.5 shadow-[0_6px_20px_rgba(10,74,82,.08)]">
          <p className="m-0 flex items-center gap-2.5 font-bold"><span className="grid size-10 flex-none place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white"><FileText size={20} aria-hidden="true" /></span><span className="min-w-0 truncate">{doc.original_name}</span></p>
          <dl className="m-0 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {describeSettings(settings).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-[var(--hi)] px-3 py-2">
                <dt className="text-sm font-semibold text-[var(--muted)]">{k}</dt><dd className="m-0 text-base font-bold leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      <QuoteCard quote={quote} loading={loading} error={error} />
      </div>
      {orderError && <Card role="alert" className="mt-3 text-danger">{orderError}</Card>}
    </CustomerLayout>
  )
}
