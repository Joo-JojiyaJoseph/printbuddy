import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import EditedPreview from '../components/EditedPreview'
import PreviewDock from '../components/PreviewDock'
import PrintSettingsForm from '../components/PrintSettingsForm'
import QuoteCard from '../components/QuoteCard'
import { useSession } from '../context/SessionContext'
import { formatINR } from '../utils/format'
import { useQuote } from '../hooks/useQuote'
import { useSavings } from '../hooks/useSavings'
import { useDocInsights } from '../hooks/useDocInsights'
import SmartAssistant from '../components/SmartAssistant'
import SavingsTip from '../components/SavingsTip'
import { outputPageCount, previewEdits, sheetsFor } from '../utils/pagePlan'
import { isImageKind } from '../utils/pagePlan'

export default function Configure() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settingsFor, setSettings } = useSession()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const doc = docs.find((d) => d.id === docId)
  const settings = settingsFor(doc)
  const n = doc ? outputPageCount(doc, settings.edits) : 0
  const { quote, error, rangeError, loading } = useQuote(token, doc, settings, n)
  const analysis = useDocInsights(doc)
  const tips = useSavings(token, doc, settings, loading ? null : quote, n)

  if (docsLoaded && (!doc || doc.status !== 'ready')) return <Navigate to={`/s/${token}/upload`} replace />
  if (!doc) return <CustomerLayout step={2} title="Edit"><div className="mt-6 h-64 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading document" /></CustomerLayout>

  const image = isImageKind(doc.kind)
  const perSheet = image ? 1 : (settings.pages_per_sheet ?? 1)
  const sheets = sheetsFor(n, perSheet) // what the preview pages through: printed sheets, not source pages
  const cur = Math.min(page, sheets)
  return (
    <CustomerLayout wide step={2} title="Choose print options" hint="Pick colour, paper and sides. The price updates as you go."
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/edit/${doc.id}`)}>Back</Button>
        <Button disabled={!quote || loading || !!rangeError} onClick={() => navigate(`/s/${token}/review/${doc.id}`)}>{quote ? `Review · ${formatINR(quote.total_paise)}` : 'Review'}</Button>
      </>}>
      <div className="mx-auto max-w-3xl md:grid md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:gap-10">
      <PreviewDock title={`${doc.original_name} preview`}
        preview={<EditedPreview doc={doc} edits={settings.edits ?? previewEdits(doc, settings.scaling, n)} page={cur} settings={settings}
          images={docs.filter((d) => isImageKind(d.kind) && d.status === 'ready')} />}>
        <p className="m-0 mb-1 truncate text-xs font-semibold text-[var(--muted)] md:hidden">
          {settings.paper_size} · {settings.color_mode === 'color' ? 'Colour' : 'Black & white'} · {settings.orientation === 'landscape' ? 'Landscape' : 'Portrait'} · {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'}
        </p>
        {settings.duplex && (
          <p role="status" className="m-0 mb-1 text-xs font-bold text-[var(--muted)] md:text-center">
            Double-sided: sheet {Math.ceil(cur / 2)} of {Math.ceil(sheets / 2)} · {cur % 2 === 1 ? 'front' : 'back'} side
          </p>
        )}
        {sheets > 1 ? (
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--muted)] md:mb-3 md:justify-center md:gap-4">
            <button type="button" aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronLeft aria-hidden="true" /></button>
            <span>{perSheet > 1 ? 'Sheet' : 'Page'} {cur} of {sheets}</span>
            <button type="button" aria-label="Next page" disabled={cur >= sheets} onClick={() => setPage(cur + 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
          </div>
        ) : <p className="m-0 text-xs text-[var(--muted)] md:hidden">Tap the preview to enlarge it.</p>}
      </PreviewDock>
      <div className="min-w-0">
      <SmartAssistant state={analysis.state} insights={analysis.insights} settings={settings} isImage={image} pageCount={n} onApply={(patch) => setSettings({ ...settings, ...patch })} />
      <PrintSettingsForm value={settings} onChange={({ edits: _e, ...rest }) => setSettings(rest)} rangeError={rangeError} pageCount={n} showLayout={!image} />
      <div className="mt-4"><QuoteCard quote={quote} loading={loading} error={error} /></div>
      <SavingsTip tips={tips} onApply={(patch) => setSettings({ ...settings, ...patch })} />
      </div>
      </div>
    </CustomerLayout>
  )
}
