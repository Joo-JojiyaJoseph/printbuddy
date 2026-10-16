import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Backdrop from '../components/ui/Backdrop'
import { Smartphone } from 'lucide-react'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import { api } from '../services/api'
import { useCountdown, mmss } from '../hooks/useCountdown'

export default function Kiosk() {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('creating') // creating | waiting | connected | error
  const left = useCountdown(session?.expires_at)

  const start = useCallback(async () => {
    setPhase('creating')
    try { setSession(await api.createSession(new URLSearchParams(window.location.search).get('k') || 'demo')); setPhase('waiting') } catch { setPhase('error') }
  }, [])
  useEffect(() => { start() }, [start])

  // Poll while waiting for a phone AND while one is connected, so the kiosk notices when that session ends.
  useEffect(() => {
    if (!session || (phase !== 'waiting' && phase !== 'connected')) return
    const t = setInterval(async () => {
      try {
        const s = await api.getSession(session.token)
        if (s.claimed_at && phase === 'waiting') setPhase('connected')
      } catch (e) {
        if (phase === 'connected' && (e.status === 410 || e.status === 401)) { setSession(null); start() } // customer finished or cancelled
      }
    }, 2000)
    return () => clearInterval(t)
  }, [session, phase, start])

  const cancel = async () => {
    try { if (session) await api.endSession(session.token) } catch { /* already over */ }
    setSession(null); start()
  }

  const expired = session && phase === 'waiting' && left === 0
  const url = session ? `${window.location.origin}/s/${session.token}` : ''

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <Backdrop />
      <main className="relative z-10 w-full max-w-xl rounded-[36px] border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-[var(--shadow)] sm:p-9">
        <div className="mb-4 flex items-center justify-between">
          <Logo size={40} full tagline />
          <span className="text-sm font-bold text-mint" role="status">
            {phase === 'connected' ? 'Phone connected' : expired ? 'Expired' : 'Kiosk #12 · Online'}
          </span>
        </div>
        {phase !== 'connected' && (<>
        <h1 className="m-0 text-[clamp(1.375rem,4vw,1.875rem)] font-bold leading-tight tracking-tight">Scan to start printing</h1>
        <p className="mb-5 mt-2 text-[var(--muted)]">Point your phone camera at the code. No app to install.</p>
        </>)}

        {phase === 'error' && <p role="alert" className="text-danger">Couldn't start a session.</p>}
        {phase === 'creating' && <div className="mx-auto size-[15.75rem] animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Creating session" />}
        {session && phase === 'waiting' && (
          <div className={`mx-auto w-fit rounded-[26px] bg-white p-3.5 shadow-[0_0_0_6px_var(--border)] animate-pulse-ring ${expired ? 'opacity-30' : ''}`}>
            <QRCodeSVG value={url} size={224} level="M" fgColor="#10242B" bgColor="#ffffff" title="Session QR code" />
          </div>
        )}
        {session && phase === 'connected' && (
          <div className="mx-auto grid w-full max-w-sm place-items-center gap-2 rounded-[26px] bg-gradient-to-br from-[#e3f3f3] to-[#e3f3f3] px-5 py-8" role="status">
            <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_12px_30px_rgba(10,74,82,.35)]"><Smartphone size={38} aria-hidden="true" /></span>
            <p className="m-0 mt-2 text-xl font-bold">A customer is using this kiosk</p>
            <p className="m-0 text-sm text-[var(--muted)]">They are choosing files and paying on their phone. Please wait, or scan again when this screen shows a new code.</p>
          </div>
        )}
        {session && !expired && phase === 'waiting' && <p className="mt-4 text-sm text-[var(--muted)]">Session expires in <b>{mmss(left)}</b></p>}
        {phase === 'connected' && (
          <>
            <div className="mt-4 flex"><Button variant="ghost" onClick={cancel}>Cancel this session</Button></div>
            <p className="mb-0 mt-2 text-xs text-[var(--muted)]">Another phone can scan only after this session ends.</p>
          </>
        )}
        {(expired || phase === 'error') && <div className="mt-5 flex"><Button onClick={start}>Get a new code</Button></div>}
        <p className="mb-0 mt-5 text-sm text-[var(--muted)]">Scan. Upload. Pay. Print.</p>
      </main>
    </div>
  )
}
