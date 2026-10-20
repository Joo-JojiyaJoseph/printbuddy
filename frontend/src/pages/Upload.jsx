import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import UploadZone from '../components/UploadZone'
import DocumentCard from '../components/DocumentCard'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'

export default function Upload() {
  const { token, docs, uploads, upload, dismissUpload, remove, refresh, pickedIds, setPickedIds, limits } = useSession()
  const navigate = useNavigate()
  const ready = docs.filter((d) => d.status === 'ready')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Files for the next step, in the order they were ticked. A lone ready file is chosen automatically.
  const byId = Object.fromEntries(ready.map((d) => [d.id, d]))
  const picked = pickedIds.map((id) => byId[id]).filter(Boolean)
  const chosen = picked.length ? picked : ready.length === 1 ? ready : []
  const toggle = (id) => setPickedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const allImages = chosen.length > 1 && chosen.every((d) => d.kind === 'jpg' || d.kind === 'png')

  const next = async () => {
    setError(null)
    if (chosen.length === 1) return navigate(`/s/${token}/edit/${chosen[0].id}`)
    if (allImages) { // pictures go onto sheets together (2 to a page, copies...) in the arrange step
      return navigate(`/s/${token}/edit/${chosen[0].id}?with=${chosen.slice(1).map((d) => d.id).join(',')}`)
    }
    setBusy(true) // documents (or a mix) are combined into ONE PDF so they share one order and one payment
    try {
      // Joined in this browser, then sent as one ordinary PDF: the server needs no PDF tools for it.
      const { mergeInBrowser } = await import('../utils/mergeInBrowser')
      const { file } = await mergeInBrowser(chosen)
      const sent = await api.uploadDocument(token, file)
      let merged = sent
      for (let i = 0; i < 40 && merged.status !== 'ready'; i++) { // the server checks the new PDF first; wait for it
        if (merged.status === 'failed') throw new Error(merged.failure_reason || 'The combined file could not be prepared.')
        await new Promise((r) => setTimeout(r, 750))
        merged = (await api.listDocuments(token)).find((d) => d.id === sent.id) ?? merged
      }
      if (merged.status !== 'ready') throw new Error('The combined file is taking too long to prepare. Try again in a moment.')
      await refresh()
      setPickedIds([])
      navigate(`/s/${token}/edit/${merged.id}`)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const full = docs.length >= limits.maxFiles

  return (
    <CustomerLayout hero step={1}
      footer={<>
        <Button variant="ghost" onClick={() => navigate(`/s/${token}`)}>Back</Button>
        <Button loading={busy} disabled={!chosen.length} onClick={next}>{chosen.length > 1 ? `Continue with ${chosen.length} files` : 'Continue'}</Button>
      </>}>
      <h1 className="mb-1 mt-2 text-[1.292rem] font-bold leading-tight tracking-tight">Where is your file?</h1>
      <p className="mb-3 mt-0 text-sm text-[var(--muted)]">{docs.length || uploads.length ? (ready.length > 1 ? 'Tap the file you want to print. Tap more than one to print them together.' : 'Your file is ready. Tap Continue.') : 'Pick files from this phone, or scan a page with the camera.'}</p>
      <ul className="stagger mb-3 mt-1 space-y-2.5 p-0" style={{ listStyle: 'none' }} aria-label="Your documents">
        {uploads.map((u) => (
          <li key={u.tempId}>
            <Card className="!p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold">{u.name}</span>
                {u.error && <button type="button" aria-label={`Dismiss ${u.name}`} onClick={() => dismissUpload(u.tempId)} className="grid size-9 place-items-center"><X size={16} aria-hidden="true" /></button>}
              </div>
              {u.error
                ? <p role="alert" className="m-0 mt-1 text-sm text-danger">{u.error}</p>
                : <><p role="status" className="m-0 mt-1 text-xs text-[var(--muted)]">{u.note}</p><div role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${u.note ? 'Preparing' : 'Uploading'} ${u.name}`} className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                    <i className="block h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-300" style={{ width: `${u.progress}%` }} />
                  </div></>}
            </Card>
          </li>
        ))}
        {docs.map((d) => (
          <li key={d.id}>
            <DocumentCard doc={d} selectable={d.status === 'ready' && ready.length > 1} selected={chosen.some((c) => c.id === d.id)} order={chosen.length > 1 ? chosen.findIndex((c) => c.id === d.id) + 1 : 0}
              onSelect={() => toggle(d.id)} onRemove={() => remove(d.id)} />
          </li>
        ))}
      </ul>
      {(docs.length > 0 || uploads.length > 0) && <h2 className="mb-2 mt-4 text-sm font-bold text-[var(--muted)]">Add another file</h2>}
      <UploadZone onFiles={upload} disabled={full} compact={docs.length + uploads.length > 0} />
      <p className="mt-2 text-xs text-[var(--muted)]">Up to {limits.maxFiles} files, {limits.maxBytes / 1024 / 1024} MB each.</p>

      {ready.length > 1 && !chosen.length && <p className="text-sm text-amber">Tap a file above to choose it.</p>}
      {chosen.length > 1 && (
        <p role="status" className="mt-2 text-sm text-[var(--muted)]">
          {allImages ? 'These pictures can share sheets (for example 2 to a page) in the next step.' : 'These files will be combined into one print, in the order you ticked them.'}
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-bold text-danger">{error}</p>}
    </CustomerLayout>
  )
}
