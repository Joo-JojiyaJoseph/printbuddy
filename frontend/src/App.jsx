import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import SessionProvider from './context/SessionContext'

const Kiosk = lazy(() => import('./pages/Kiosk'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Upload = lazy(() => import('./pages/Upload'))
const Configure = lazy(() => import('./pages/Configure'))
const Review = lazy(() => import('./pages/Review'))
const Pay = lazy(() => import('./pages/Pay'))
const Done = lazy(() => import('./pages/Done'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/s/:token" element={<SessionProvider />}>
          <Route index element={<Welcome />} />
          <Route path="upload" element={<Upload />} />
          <Route path="configure/:docId" element={<Configure />} />
          <Route path="review/:docId" element={<Review />} />
          <Route path="pay/:ref" element={<Pay />} />
          <Route path="done/:ref" element={<Done />} />
        </Route>
        <Route path="*" element={<Navigate to="/kiosk" replace />} />
      </Routes>
    </Suspense>
  )
}
