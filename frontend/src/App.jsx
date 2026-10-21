import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route, useParams } from 'react-router-dom'
import SessionProvider from './context/SessionContext'
const Kiosk = lazy(() => import('./pages/Kiosk'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Upload = lazy(() => import('./pages/Upload'))
const Edit = lazy(() => import('./pages/Edit'))
const Review = lazy(() => import('./pages/Review'))
const Pay = lazy(() => import('./pages/Pay'))
const Done = lazy(() => import('./pages/Done'))
const AdminApp = lazy(() => import('./admin/AdminApp'))
import ErrorBoundary from './components/ErrorBoundary'

// Each screen loads on demand, so the first paint only downloads what that screen needs (the PDF engine loads only when editing).
function Loading() {
  return <div role="status" aria-label="Loading" className="grid min-h-dvh place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line,#cbd5e1)] border-t-[var(--brand,#6366f1)]" /></div>
}

// Print options used to be a separate screen. Old links and bookmarks land on the single combined screen.
/** Typed or edited links: a lower-case order number still finds the order, and an unknown page inside a session goes to its start. */
function UpperRef({ children, to }) {
  const { token, ref } = useParams()
  return ref !== ref.toUpperCase() ? <Navigate to={`/s/${token}/${to}/${ref.toUpperCase()}`} replace /> : children
}
function SessionHome() {
  const { token } = useParams()
  return <Navigate to={`/s/${token}`} replace />
}

function OldConfigure() {
  const { token, docId } = useParams()
  return <Navigate to={`/s/${token}/edit/${docId}`} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/k/:code" element={<Kiosk />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/s/:token" element={<SessionProvider />}>
          <Route index element={<Welcome />} />
          <Route path="upload" element={<Upload />} />
          <Route path="edit/:docId" element={<Edit />} />
          <Route path="configure/:docId" element={<OldConfigure />} />
          <Route path="review/:docId" element={<Review />} />
          <Route path="pay/:ref" element={<UpperRef to="pay"><Pay /></UpperRef>} />
          <Route path="done/:ref" element={<UpperRef to="done"><Done /></UpperRef>} />
          <Route path="*" element={<SessionHome />} />
        </Route>
        <Route path="*" element={<Navigate to="/kiosk" replace />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
