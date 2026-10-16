import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from './ui/Modal'
import PdfPreview from './PdfPreview'
import ImagePreview from './ImagePreview'

/** Full-size look at an uploaded file in a pop-up. */
export default function DocPreviewModal({ doc, open, onClose }) {
  const [page, setPage] = useState(1)
  const image = doc.kind === 'jpg' || doc.kind === 'png'
  const n = doc.page_count ?? 1
  return (
    <Modal open={open} onClose={onClose} title={doc.original_name} size="lg">
      <div className="mt-3">
        {image ? <ImagePreview url={doc.preview_url} name={doc.original_name} /> : <PdfPreview url={doc.preview_url} page={page} />}
      </div>
      {!image && n > 1 && (
        <div className="mt-3 flex items-center justify-center gap-4 text-sm font-bold text-[var(--muted)]">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] bg-white disabled:opacity-30"><ChevronLeft aria-hidden="true" /></button>
          <span>Page {page} of {n}</span>
          <button type="button" aria-label="Next page" disabled={page >= n} onClick={() => setPage(page + 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] bg-white disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
        </div>
      )}
    </Modal>
  )
}
