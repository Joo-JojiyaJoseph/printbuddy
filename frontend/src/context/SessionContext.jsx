import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { validateFile, LIMITS } from '../utils/fileValidation'
import { DEFAULT_SETTINGS } from '../utils/printOptions'
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
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let off = false
    api.getSession(token, { claim: true })
      .then((session) => !off && setState({ status: 'ready', session }))
      .catch((e) => !off && setState({ status: e.status === 410 ? 'expired' : e.status === 404 ? 'missing' : 'error', message: e.message }))
    return () => { off = true }
  }, [token])

  const refresh = useCallback(async () => {
    try { setDocs(await api.listDocuments(token)); setDocsLoaded(true) } catch { /* session may have expired */ }
  }, [token])

  useEffect(() => { if (state.status === 'ready') refresh() }, [state.status, refresh])

  // A document remains `uploaded` until a queue worker starts its conversion.
  // Keep polling throughout both pending states so the UI observes `ready`.
  const processing = docs.some((d) => d.status === 'uploaded' || d.status === 'converting')
  useEffect(() => {
    if (!processing) return
    const t = setInterval(refresh, 700)
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
    setSelectedId((s) => (s === id ? null : s))
    await refresh()
  }, [token, refresh])

  const value = useMemo(() => ({
    token, session: state.session, docs, docsLoaded, uploads, upload, dismissUpload, remove,
    settings, setSettings, selectedId, setSelectedId, limits: LIMITS,
  }), [token, state.session, docs, docsLoaded, uploads, upload, dismissUpload, remove, settings, selectedId])

  if (state.status === 'loading') {
    return <CustomerLayout step={0} title="PrintBuddy"><div className="mt-10 h-32 animate-pulse rounded-3xl bg-[var(--hi)]" aria-label="Loading session" role="status" /></CustomerLayout>
  }
  if (state.status !== 'ready') {
    const msg = state.status === 'expired' ? 'This session has expired.' : state.status === 'missing' ? "We couldn't find this session." : state.message
    return (
      <CustomerLayout step={0} title="PrintBuddy">
        <Card className="mt-8 text-center" role="alert">
          <h1 className="m-0 text-2xl font-extrabold">{msg}</h1>
          <p className="mt-2 text-[var(--muted)]">Scan the QR code on the kiosk again to start a new session.</p>
        </Card>
      </CustomerLayout>
    )
  }
  return <SessionContext.Provider value={value}><Outlet /></SessionContext.Provider>
}
