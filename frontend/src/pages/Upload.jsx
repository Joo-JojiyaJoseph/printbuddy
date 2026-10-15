import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import UploadZone from '../components/UploadZone'
import DocumentCard from '../components/DocumentCard'
import { useSession } from '../context/SessionContext'

export default function Upload() {
  const { token, docs, uploads, upload, dismissUpload, remove, selectedId, setSelectedId, limits } = useSession()
  const navigate = useNavigate()
  const ready = docs.filter((d) => d.status === 'ready')
  const chosen = ready.find((d) => d.id === selectedId) ?? (ready.length === 1 ? ready[0] : null)
  const full = docs.length >= limits.maxFiles

  return (
    <CustomerLayout step={1} title="Upload"
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}`)}>Back</Button>
        <Button disabled={!chosen} onClick={() => navigate(`/s/${token}/configure/${chosen.id}`)}>Continue</Button>
      </>}>
      <h1 className="mb-3 mt-2 text-[27px] font-extrabold leading-tight tracking-tight">Where is your file?</h1>
      <UploadZone onFiles={upload} disabled={full} />
      <p className="mt-2 text-xs text-[var(--muted)]">Up to {limits.maxFiles} files, {limits.maxBytes / 1024 / 1024} MB each.</p>

      <ul className="mt-3 space-y-2.5 p-0" style={{ listStyle: 'none' }} aria-label="Your documents">
        {uploads.map((u) => (
          <li key={u.tempId}>
            <Card className="!p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold">{u.name}</span>
                {u.error && <button type="button" aria-label={`Dismiss ${u.name}`} onClick={() => dismissUpload(u.tempId)} className="grid size-9 place-items-center"><X size={16} aria-hidden="true" /></button>}
              </div>
              {u.error
                ? <p role="alert" className="m-0 mt-1 text-sm text-danger">{u.error}</p>
                : <div role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`} className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                    <i className="block h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300" style={{ width: `${u.progress}%` }} />
                  </div>}
            </Card>
          </li>
        ))}
        {docs.map((d) => (
          <li key={d.id}>
            <DocumentCard doc={d} selectable={d.status === 'ready' && ready.length > 1} selected={chosen?.id === d.id}
              onSelect={() => setSelectedId(d.id)} onRemove={() => remove(d.id)} />
          </li>
        ))}
      </ul>
      {ready.length > 1 && !chosen && <p className="text-sm text-amber">Tap the document you want to print.</p>}
    </CustomerLayout>
  )
}
