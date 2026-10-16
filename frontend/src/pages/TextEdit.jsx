import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import { useSession } from '../context/SessionContext'
import { api } from '../services/api'

const FRAME_CSS = 'body{font:16px/1.45 Georgia,"Times New Roman",serif;color:#111;background:#fff;margin:0;padding:14px;overflow-wrap:anywhere}'
  + 'table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:3px 6px}img{max-width:100%}'
const SIZES = [['2', 'Small'], ['3', 'Normal'], ['5', 'Large'], ['6', 'Huge']]
const btn = 'grid size-11 flex-none place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] active:scale-95'

/**
 * Rich-text editing of the document's text. The content is server-sanitised HTML shown in an iframe with
 * `sandbox="allow-same-origin"` (no scripts can ever run in it); saving sends it back to be rebuilt as the print PDF.
 */
export default function TextEdit() {
  const { docId } = useParams()
  const { token, docs, docsLoaded, refresh } = useSession()
  const navigate = useNavigate()
  const frameRef = useRef(null)
  const doc = docs.find((d) => d.id === docId)
  const [load, setLoad] = useState({ status: 'loading' })
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const back = () => navigate(`/s/${token}/edit/${docId}`)

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let off = false
    setLoad({ status: 'loading' })
    api.getEditable(token, docId)
      .then((r) => !off && setLoad({ status: 'ready', ...r }))
      .catch((e) => { console.error('Open for editing failed:', e); if (!off) setLoad({ status: 'error', message: e.message }) })
    return () => { off = true }
  }, [token, docId, attempt])

  useEffect(() => {
    if (load.status !== 'ready') return
    const d = frameRef.current?.contentDocument
    if (!d) return
    d.open()
    d.write(`<!doctype html><html><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body>${load.html}</body></html>`)
    d.close()
    d.designMode = 'on'
    try { d.execCommand('styleWithCSS', false, true) } catch { /* optional */ }
  }, [load])

  const exec = (cmd, value) => {
    const f = frameRef.current
    if (!f?.contentDocument) return
    f.contentWindow.focus()
    f.contentDocument.execCommand(cmd, false, value)
  }

  const save = async () => {
    const html = frameRef.current?.contentDocument?.body?.innerHTML ?? ''
    setBusy('save'); setError(null)
    try {
      await api.saveDocumentContent(token, docId, html)
      await refresh()
      back()
    } catch (e) { setError(e.message); setBusy(null) }
  }
  const revert = async () => {
    setBusy('revert'); setError(null)
    try { await api.revertDocument(token, docId); await refresh(); back() } catch (e) { setError(e.message); setBusy(null) }
  }

  if (docsLoaded && (!doc || doc.status !== 'ready' || !doc.can_edit_text)) return <Navigate to={`/s/${token}/edit/${docId}`} replace />
  const tools = [
    ['Bold', Bold, 'bold'], ['Italic', Italic, 'italic'], ['Underline', Underline, 'underline'],
    ['Align left', AlignLeft, 'justifyLeft'], ['Centre', AlignCenter, 'justifyCenter'], ['Align right', AlignRight, 'justifyRight'], ['Justify', AlignJustify, 'justifyFull'],
    ['Bullet list', List, 'insertUnorderedList'], ['Numbered list', ListOrdered, 'insertOrderedList'], ['Undo', Undo2, 'undo'], ['Redo', Redo2, 'redo'],
  ]
  return (
    <CustomerLayout wide step={2} title="Edit text"
      footer={<>
        <Button variant="ghost" disabled={!!busy} onClick={back}>Cancel</Button>
        <Button loading={busy === 'save'} disabled={load.status !== 'ready' || !!busy} onClick={save}>Save changes</Button>
      </>}>
      {load.status === 'loading' && <><div className="mt-4 h-64 animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Opening document for editing" /><p className="mt-2 text-center text-sm text-[var(--muted)]">Opening your document… Word files can take up to a minute the first time.</p></>}
      {load.status === 'error' && (
        <div role="alert" className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
          <p className="m-0 font-bold text-danger">{load.message}</p>
          <p className="mb-0 mt-1 text-sm text-[var(--muted)]">You can still print the document as it is.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-2 min-h-11 font-bold text-accent underline">Try again</button>
        </div>
      )}
      {load.status === 'ready' && (
        <>
          {load.lossy && <p role="note" className="mb-2 rounded-2xl border border-amber/40 bg-amber/15 px-3 py-2 text-sm text-amber">
            We read the text out of your PDF so you can fix it. Pictures and the exact layout are not kept — saving rebuilds the pages from this text.</p>}
          {load.source === 'saved' && <p role="note" className="mb-2 text-sm text-[var(--muted)]">Showing your last saved edit.</p>}
          <div role="toolbar" aria-label="Text formatting" className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {tools.map(([label, Icon, cmd]) => (
              <button key={cmd} type="button" aria-label={label} className={btn} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd)}><Icon size={18} aria-hidden="true" /></button>
            ))}
            <select aria-label="Text size" defaultValue="3" onChange={(e) => exec('fontSize', e.target.value)}
              className="min-h-11 flex-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-2 text-sm font-bold">
              {SIZES.map(([v, l]) => <option key={v} value={v} className="text-black">{l}</option>)}
            </select>
          </div>
          <iframe ref={frameRef} title="Document text editor" sandbox="allow-same-origin" className="h-[46dvh] w-full rounded-2xl border border-[var(--border)] bg-white" />
          <p className="mb-0 mt-2 text-xs text-[var(--muted)]">Your original upload is never changed. {doc?.edited && 'This document already has saved text edits.'}</p>
          {doc?.edited && <button type="button" disabled={!!busy} onClick={revert} className="mt-1 min-h-10 text-sm font-bold text-danger">{busy === 'revert' ? 'Restoring…' : 'Discard text edits and restore the original'}</button>}
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-bold text-danger">{error}</p>}
    </CustomerLayout>
  )
}
