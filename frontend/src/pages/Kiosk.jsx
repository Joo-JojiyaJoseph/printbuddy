import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Backdrop from '../components/ui/Backdrop'
import Button from '../components/ui/Button'
import { api } from '../services/api'
import { useCountdown, mmss } from '../hooks/useCountdown'

export default function Kiosk() {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('creating') // creating | waiting | connected | error
  const left = useCountdown(session?.expires_at)

  const start = useCallback(async () => {
    setPhase('creating')
    try { setSession(await api.createSession('demo')); setPhase('waiting') } catch { setPhase('error') }
  }, [])
  useEffect(() => { start() }, [start])

  useEffect(() => {
    if (!session || phase !== 'waiting') return
    const t = setInterval(async () => {
      try { if ((await api.getSession(session.token)).claimed_at) setPhase('connected') } catch { /* expiry handled by countdown */ }
    }, 2000)
    return () => clearInterval(t)
  }, [session, phase])

  const expired = session && left === 0
  const url = session ? `${window.location.origin}/s/${session.token}` : ''

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <Backdrop />
      <main className="relative z-10 w-full max-w-xl rounded-[36px] border border-[var(--border)] bg-[var(--card)] p-6 text-center backdrop-blur-xl shadow-[0_30px_80px_rgba(10,5,60,.35)] sm:p-9">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xl font-extrabold">🖨 PrintBuddy</span>
          <span className="text-sm font-bold text-accent" role="status">
            {phase === 'connected' ? 'Phone connected' : expired ? 'Expired' : 'Kiosk #12 · Online'}
          </span>
        </div>
        <h1 className="m-0 text-[clamp(26px,5vw,40px)] font-extrabold leading-tight tracking-tight">Scan to start printing</h1>
        <p className="mb-5 mt-2 text-[var(--muted)]">Point your phone camera at the code. No app to install.</p>

        {phase === 'error' && <p role="alert" className="text-danger">Couldn't start a session.</p>}
        {phase === 'creating' && <div className="mx-auto size-[252px] animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Creating session" />}
        {session && phase !== 'creating' && (
          <div className={`mx-auto w-fit rounded-[26px] bg-white p-3.5 shadow-[0_0_0_6px_var(--border)] animate-pulse-ring ${expired ? 'opacity-30' : ''}`}>
            <QRCodeSVG value={url} size={224} level="M" fgColor="#1d1845" bgColor="#ffffff" title="Session QR code" />
          </div>
        )}
        {session && !expired && phase === 'waiting' && <p className="mt-4 text-sm text-[var(--muted)]">Session expires in <b>{mmss(left)}</b></p>}
        {phase === 'connected' && <p className="mt-4 font-bold text-accent">Connected. Continue on your phone.</p>}
        {(expired || phase === 'error') && <div className="mt-5 flex"><Button onClick={start}>Get a new code</Button></div>}
        <p className="mb-0 mt-5 text-sm text-[var(--muted)]">Scan. Upload. Pay. Print.</p>
      </main>
    </div>
  )
}
