import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { validateFile, LIMITS } from '../utils/fileValidation'
import { DEFAULT_SETTINGS } from '../utils/printOptions'
import { isImageKind } from '../utils/pagePlan'
import CustomerLayout from '../layouts/CustomerLayout'
import Card from '../components/ui/Card'

const SessionContext = createContext(null)
export const useSession = () => useContext(SessionContext)
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function SessionProvider() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })
  const [docs, setDocs] = useState([])
  const [docsLoaded, setDocsLoaded] = useState(false)
  const [uploads, setUploads] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [pickedIds, setPickedIds] = useState([]) // files chosen for the next step, in the order they were ticked
  // Page edits / image layouts per document: { [docId]: { pageCount, edits } }. Dropped automatically if the document changes.
  const [editsMap, setEditsMap] = useState({})

  useEffect(() => {
    let off = false, timer
    // A busy or briefly unavailable server (5xx / network) is retried a few times before an error is shown.
    const load = (attempt) => api.getSession(token, { claim: true })
      .then((session) => !off && setState({ status: 'ready', session }))
      .catch((e) => {
        if (off) return
        const transient = !e.status || e.status >= 500
        if (transient && attempt < 4) { timer = setTimeout(() => load(attempt + 1), 600 * (attempt + 1)); return }
        setState({ status: e.status === 410 ? 'expired' : e.status === 404 ? 'missing' : e.status === 423 ? 'busy' : 'error', message: e.message })
      })
    load(0)
    return () => { off = true; clearTimeout(timer) }
  }, [token])

  const endSession = useCallback(async () => {
    try { await api.endSession(token) } catch { /* already over: same result for the customer */ }
    setState({ status: 'ended' })
  }, [token])

  const refresh = useCallback(async () => {
    // One quiet retry: the server may be busy for a moment (e.g. converting another file).
    for (let i = 0; i < 2; i++) {
      try { setDocs(await api.listDocuments(token)); setDocsLoaded(true); return } catch { await new Promise((r) => setTimeout(r, 800)) }
    }
  }, [token])

  useEffect(() => { if (state.status === 'ready') refresh() }, [state.status, refresh])

  // A document remains `uploaded` until a queue worker starts its conversion.
  // Keep polling throughout both pending states so the UI observes `ready`.
  const processing = docs.some((d) => d.status === 'uploaded' || d.status === 'converting')
  useEffect(() => {
    if (!processing) return
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
  }, [processing, refresh])

  const upload = useCallback(async (files) => {
    let count = docs.length + uploads.filter((u) => !u.error).length
    for (const file of files) {
      const tempId = uid()
      const patch = (p) => setUploads((u) => u.map((x) => (x.tempId === tempId ? { ...x, ...p } : x)))
      setUploads((u) => [...u, { tempId, name: file.name, progress: 0 }])
      const v = await validateFile(file, count)
      if (!v.ok) { patch({ error: v.error }); continue }
      count += 1
      try {
        await api.uploadDocument(token, file, { onProgress: (progress) => patch({ progress }) })
        setUploads((u) => u.filter((x) => x.tempId !== tempId))
        await refresh()
      } catch (e) {
        count -= 1
        patch({ error: e.message })
      }
    }
  }, [token, docs.length, uploads, refresh])

  const dismissUpload = useCallback((tempId) => setUploads((u) => u.filter((x) => x.tempId !== tempId)), [])
  const remove = useCallback(async (id) => {
    await api.deleteDocument(token, id)
    setPickedIds((p) => p.filter((x) => x !== id))
    await refresh()
  }, [token, refresh])

  const editsFor = useCallback((doc) => {
    const entry = doc && editsMap[doc.id]
    if (!entry || entry.pageCount !== doc.page_count) return null
    const sheet = entry.edits?.sheet
    if (!sheet) return entry.edits
    const ready = new Set(docs.filter((d) => isImageKind(d.kind) && d.status === 'ready').map((d) => d.id))
    const images = sheet.images.filter((i) => ready.has(i.document_id))
    return images.some((i) => i.document_id === doc.id) ? { sheet: { ...sheet, images } } : null
  }, [editsMap, docs])
  const setEditsFor = useCallback((doc, edits) => setEditsMap((m) => {
    const next = { ...m }
    if (edits) next[doc.id] = { pageCount: doc.page_count, edits }
    else delete next[doc.id]
    return next
  }), [])
  const settingsFor = useCallback((doc) => ({ ...settings, edits: doc ? editsFor(doc) : null }), [settings, editsFor])

  const value = useMemo(() => ({
    token, session: state.session, docs, docsLoaded, uploads, upload, dismissUpload, remove, refresh,
    settings, setSettings, pickedIds, setPickedIds, limits: LIMITS, editsFor, setEditsFor, settingsFor, endSession,
  }), [endSession, token, state.session, docs, docsLoaded, uploads, upload, dismissUpload, remove, refresh, settings, pickedIds, editsFor, setEditsFor, settingsFor])

  if (state.status === 'loading') {
    return <CustomerLayout step={0} title="Taprint"><div className="mt-10 h-32 animate-pulse rounded-3xl bg-[var(--hi)]" aria-label="Loading session" role="status" /></CustomerLayout>
  }
  if (state.status !== 'ready') {
    if (state.status === 'ended') {
      return (
        <CustomerLayout step={0} title="Taprint">
          <Card className="mt-8 text-center" role="status">
            <h1 className="m-0 text-xl font-bold">Session ended</h1>
            <p className="mt-2 text-[var(--muted)]">Your files have been removed. To print again, scan the new QR code on the kiosk.</p>
          </Card>
        </CustomerLayout>
      )
    }
    if (state.status === 'busy') {
      return (
        <CustomerLayout step={0} title="Taprint">
          <Card className="mt-8 text-center" role="alert">
            <h1 className="m-0 text-xl font-bold">This QR code is in use</h1>
            <p className="mt-2 text-[var(--muted)]">Another phone is already connected to this kiosk. Please wait until that person finishes, or ask them to cancel. The kiosk will then show a new QR code for you.</p>
          </Card>
        </CustomerLayout>
      )
    }
    const msg = state.status === 'expired' ? 'This session has expired.' : state.status === 'missing' ? "We couldn't find this session." : state.message
    return (
      <CustomerLayout step={0} title="Taprint">
        <Card className="mt-8 text-center" role="alert">
          <h1 className="m-0 text-xl font-bold">{msg}</h1>
          <p className="mt-2 text-[var(--muted)]">Scan the QR code on the kiosk again to start a new session.</p>
        </Card>
      </CustomerLayout>
    )
  }
  return <SessionContext.Provider value={value}><Outlet /></SessionContext.Provider>
}
