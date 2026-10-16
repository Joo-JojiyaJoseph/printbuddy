import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import DocCustomize from '../components/DocCustomize'
import ImageCustomize from '../components/ImageCustomize'
import QuoteCard from '../components/QuoteCard'
import SavingsTip from '../components/SavingsTip'
import SmartAssistant from '../components/SmartAssistant'
import { useSession } from '../context/SessionContext'
import { useQuote } from '../hooks/useQuote'
import { useSavings } from '../hooks/useSavings'
import { useDocInsights } from '../hooks/useDocInsights'
import { formatINR } from '../utils/format'
import { isImageKind, outputPageCount } from '../utils/pagePlan'

/**
 * Step 2, one screen: arrange the pages (or place the pictures), choose the print options and see the price.
 * Nothing here needs a second page, so the customer goes straight from this screen to Review.
 */
export default function Edit() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settingsFor, setSettings, editsFor, setEditsFor } = useSession()
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const doc = docs.find((d) => d.id === docId)
  const settings = settingsFor(doc)
  const n = doc ? outputPageCount(doc, settings.edits) : 0
  const { quote, error, rangeError, loading } = useQuote(token, doc, settings, n)
  const analysis = useDocInsights(doc)
  const tips = useSavings(token, doc, settings, loading ? null : quote, n)

  if (docsLoaded && (!doc || doc.status !== 'ready')) return <Navigate to={`/s/${token}/upload`} replace />
  if (!doc) return <CustomerLayout step={2} title="Your print"><div className="mt-6 h-64 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading document" /></CustomerLayout>

  const image = isImageKind(doc.kind)
  const apply = (patch) => setSettings({ ...settings, ...patch })
  const common = {
    doc, settings, setSettings, rangeError, onEdits: (e) => setEditsFor(doc, e), edits: editsFor(doc),
    assistant: <SmartAssistant state={analysis.state} insights={analysis.insights} settings={settings} isImage={image} pageCount={n} onApply={apply} />,
    tail: <>
      <div className="mt-4"><QuoteCard quote={quote} loading={loading} error={error} /></div>
      <SavingsTip tips={tips} onApply={apply} />
    </>,
  }
  const withIds = (query.get('with') ?? '').split(',').filter(Boolean)
  return (
    <CustomerLayout wide step={2} title={image ? 'Place your pictures' : 'Set up your print'}
      hint={image ? 'Drag a picture to place it, then choose how to print. The price updates as you go.' : 'Check your pages, then pick colour, paper and sides. The price updates as you go.'}
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/upload`)}>Back</Button>
        <Button disabled={!quote || loading || !!rangeError} onClick={() => navigate(`/s/${token}/review/${doc.id}`)}>{quote ? `Review · ${formatINR(quote.total_paise)}` : 'Review'}</Button>
      </>}>
      {image
        ? <ImageCustomize key={doc.id} {...common} images={docs.filter((d) => isImageKind(d.kind) && d.status === 'ready')} seedIds={withIds} />
        : <DocCustomize key={`${doc.id}-${doc.page_count}-${doc.preview_url}`} {...common} />}
    </CustomerLayout>
  )
}
