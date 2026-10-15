import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import PdfPreview from '../components/PdfPreview'
import ImagePreview from '../components/ImagePreview'
import PrintSettingsForm from '../components/PrintSettingsForm'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { useQuote } from '../hooks/useQuote'

export default function Configure() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settings, setSettings } = useSession()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const doc = docs.find((d) => d.id === docId)
  const { quote, error, rangeError, loading } = useQuote(token, doc, settings)

  if (docsLoaded && (!doc || doc.status !== 'ready')) return <Navigate to={`/s/${token}/upload`} replace />
  if (!doc) return <CustomerLayout step={2} title="Edit"><div className="mt-6 h-64 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading document" /></CustomerLayout>

  const n = doc.page_count
  const cur = Math.min(page, n)
  return (
    <CustomerLayout step={2} title="Preview & settings"
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/upload`)}>Back</Button>
        <Button disabled={!quote || loading || !!rangeError} onClick={() => navigate(`/s/${token}/review/${doc.id}`)}>Review</Button>
      </>}>
      <div className="mx-auto w-full max-w-[320px] py-2">
        {doc.kind === 'jpg' || doc.kind === 'png' ? <ImagePreview url={doc.preview_url} name={doc.original_name} /> : <PdfPreview url={doc.preview_url} page={cur} />}
      </div>
      {n > 1 && (
        <div className="mb-3 flex items-center justify-center gap-4 text-sm font-bold text-[var(--muted)]">
          <button type="button" aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronLeft aria-hidden="true" /></button>
          <span>Page {cur} of {n}</span>
          <button type="button" aria-label="Next page" disabled={cur >= n} onClick={() => setPage(cur + 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
        </div>
      )}
      <PrintSettingsForm value={settings} onChange={setSettings} rangeError={rangeError} pageCount={n} />
      <div className="mt-4"><QuoteCard quote={quote} loading={loading} error={error} /></div>
    </CustomerLayout>
  )
}