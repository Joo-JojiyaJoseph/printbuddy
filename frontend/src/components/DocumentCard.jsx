import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Eye, FileText, Image, Loader2, Trash2 } from 'lucide-react'
import DocPreviewModal from './DocPreviewModal'
import { formatBytes } from '../utils/format'

/** One uploaded file. Tap the card to select it for printing; a number shows the order when several are selected. */
export default function DocumentCard({ doc, selected, selectable, order, onSelect, onRemove }) {
  const preparing = doc.status === 'uploaded' || doc.status === 'converting'
  const [slow, setSlow] = useState(false)
  const [look, setLook] = useState(false)
  useEffect(() => {
    if (!preparing) { setSlow(false); return undefined }
    const t = setTimeout(() => setSlow(true), 25000)
    return () => clearTimeout(t)
  }, [preparing])
  const Icon = doc.kind === 'jpg' || doc.kind === 'png' ? Image : FileText
  return (
    <div className={`flex items-center gap-2 rounded-[var(--radius-card)] border-2 bg-white p-2.5 transition-colors ${selected ? 'border-accent-2 bg-[#eef8f8] shadow-[0_6px_18px_rgba(10,74,82,.15)]' : 'border-[var(--border)]'}`}>
      <button type="button" disabled={!selectable} onClick={onSelect} aria-pressed={selected}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
        <span className={`grid size-11 flex-none place-items-center rounded-2xl ${selected ? 'bg-gradient-to-br from-accent to-accent-2 text-white' : 'bg-[var(--hi)] text-[var(--muted)]'}`}>
          {selected ? (order ? <span className="text-base font-bold" aria-label={`Number ${order}`}>{order}</span> : <Check size={22} strokeWidth={3} aria-hidden="true" />) : <Icon aria-hidden="true" size={22} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-bold">{doc.original_name}</span>
          <span className="block text-xs text-[var(--muted)]">
            {formatBytes(doc.size_bytes)} ·{' '}
            {doc.status === 'ready' && `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}`}
            {preparing && <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Preparing preview…</span>}
            {doc.status === 'failed' && <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle size={12} aria-hidden="true" />Failed</span>}
          </span>
          {preparing && slow && <span role="status" className="mt-1 block text-xs text-amber">Taking longer than usual. Word and Excel files can need up to a minute. If this stays, remove the file and upload it again, or ask the attendant.</span>}
          {doc.status === 'failed' && <span role="alert" className="mt-1 block text-xs text-danger">{doc.failure_reason}</span>}
        </span>
      </button>
      {doc.status === 'ready' && doc.preview_url && (
        <button type="button" onClick={() => setLook(true)} aria-label={`Preview ${doc.original_name}`}
          className="grid size-10 flex-none place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--hi)] hover:text-accent-2 active:scale-90"><Eye size={18} aria-hidden="true" /></button>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${doc.original_name}`}
        className="grid size-10 flex-none place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--hi)] hover:text-danger active:scale-90"><Trash2 size={18} aria-hidden="true" /></button>
    {look && <DocPreviewModal doc={doc} open onClose={() => setLook(false)} />}
    </div>
  )
}
