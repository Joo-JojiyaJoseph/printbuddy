import { FileText, Image, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import Card from './ui/Card'
import { formatBytes } from '../utils/format'

export default function DocumentCard({ doc, selected, selectable, onSelect, onRemove }) {
  const Icon = doc.kind === 'jpg' || doc.kind === 'png' ? Image : FileText
  return (
    <Card className={`flex items-center gap-3 !p-3 ${selected ? 'ring-2 ring-accent' : ''}`}>
      <button type="button" disabled={!selectable} onClick={onSelect} aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
        <span className="grid size-11 flex-none place-items-center rounded-2xl bg-[var(--hi)]"><Icon aria-hidden="true" size={22} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold">{doc.original_name}</span>
          <span className="block text-xs text-[var(--muted)]">
            {formatBytes(doc.size_bytes)} ·{' '}
            {doc.status === 'ready' && `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}`}
            {(doc.status === 'uploaded' || doc.status === 'converting') && <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Preparing preview…</span>}
            {doc.status === 'failed' && <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle size={12} aria-hidden="true" />Failed</span>}
          </span>
          {doc.status === 'failed' && <span role="alert" className="mt-1 block text-xs text-danger">{doc.failure_reason}</span>}
        </span>
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${doc.original_name}`}
        className="grid size-11 flex-none place-items-center rounded-2xl border border-[var(--border)] active:scale-90"><Trash2 size={18} aria-hidden="true" /></button>
    </Card>
  )
}
