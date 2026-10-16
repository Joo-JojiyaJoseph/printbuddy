import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import PageEditor from '../components/PageEditor'
import ImageLayoutEditor from '../components/ImageLayoutEditor'
import { useSession } from '../context/SessionContext'
import { isImageKind, paperMm, paperRatio } from '../utils/pagePlan'

/** Step 2: fix the pages (documents) or arrange the images (JPG/PNG) before choosing print settings. */
export default function Edit() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, settings, setSettings, editsFor, setEditsFor } = useSession()
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const doc = docs.find((d) => d.id === docId)
  const withIds = (query.get('with') ?? '').split(',').filter(Boolean)

  if (docsLoaded && (!doc || doc.status !== 'ready')) return <Navigate to={`/s/${token}/upload`} replace />
  if (!doc) return <CustomerLayout step={2} title="Edit"><div className="mt-6 h-64 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Loading document" /></CustomerLayout>

  const image = isImageKind(doc.kind)
  const paper = { size: settings.paper_size, orientation: settings.orientation }
  const readyImages = docs.filter((d) => isImageKind(d.kind) && d.status === 'ready')
  return (
    <CustomerLayout wide step={2} title={image ? 'Arrange your pictures' : 'Check your pages'} hint={image ? 'Choose how many pictures go on each sheet.' : 'Looks fine? Just tap Next. Need a change? Use the buttons below.'}
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}/upload`)}>Back</Button>
        <Button onClick={() => navigate(`/s/${token}/configure/${doc.id}`)}>Next</Button>
      </>}>
      {image
        ? <ImageLayoutEditor key={doc.id} doc={doc} seedIds={withIds} images={readyImages} edits={editsFor(doc)} onEdits={(e) => setEditsFor(doc, e)}
            paper={paper} onOrientation={(orientation) => setSettings({ ...settings, orientation })} />
        : <PageEditor key={`${doc.id}-${doc.page_count}-${doc.preview_url}`} doc={doc} edits={editsFor(doc)} onEdits={(e) => setEditsFor(doc, e)}
            ratio={paperRatio(paper.size, paper.orientation)} paperMm={paperMm(paper.size, paper.orientation)} onEditText={() => navigate(`/s/${token}/edit/${doc.id}/text`)} />}
    </CustomerLayout>
  )
}
