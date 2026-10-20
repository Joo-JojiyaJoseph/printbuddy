import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Backdrop from '../components/ui/Backdrop'
import HelpButton from '../components/HelpGuide'
import { Printer, RefreshCw, ScanLine, Smartphone, UploadCloud, Wallet, X } from 'lucide-react'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import { api } from '../services/api'
import { useCountdown, mmss } from '../hooks/useCountdown'

export default function Kiosk() {
  const [session, setSession] = useState(null)
  const [phase, setPhase] = useState('creating') // creating | waiting | connected | error
  const [problem, setProblem] = useState(0) // HTTP status of the last failure (0 = could not reach the server)
  const left = useCountdown(session?.expires_at)

  // Refreshing this screen must not disturb the person who is printing, so the current code is remembered here and picked up again.
  const kioskId = new URLSearchParams(window.location.search).get('k') || 'demo'
  const memory = `taprint.screen.${kioskId}`
  const remember = (s) => { try { s ? localStorage.setItem(memory, JSON.stringify({ token: s.token, expires_at: s.expires_at })) : localStorage.removeItem(memory) } catch { /* private mode: nothing to remember */ } }
  const starting = useRef(false)
  const start = useCallback(async (fresh = false) => {
    if (starting.current) return
    starting.current = true
    setPhase('creating')
    try {
      // Same code as before the refresh, if it is still alive: the screen carries on as if nothing happened.
      if (!fresh) {
        try {
          const saved = JSON.parse(localStorage.getItem(memory) || 'null')
          if (saved?.token) {
            const now = await api.getSession(saved.token)
            if ((!now.status || now.status === 'active' || now.status === 'waiting') && Date.parse(now.expires_at) > Date.now()) {
              setSession({ ...saved, ...now, token: saved.token })
              setPhase(now.claimed_at ? 'connected' : 'waiting')
              return
            }
          }
        } catch { /* gone or expired: get a new code below */ }
      }
      const s = await api.createSession(kioskId)
      remember(s); setSession(s); setPhase('waiting')
    } catch (e) { setProblem(e?.status ?? 0); setPhase('error') } finally { starting.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { start() }, [start])
  // If the code could not be made because of a short-lived problem (no connection, too many tries, server busy), try again on its own.
  useEffect(() => {
    if (phase !== 'error' || problem === 404) return undefined
    const t = setTimeout(() => start(true), 8000)
    return () => clearTimeout(t)
  }, [phase, problem, start])

  // Poll while waiting for a phone AND while one is connected, so the kiosk notices when that session ends.
  useEffect(() => {
    if (!session || (phase !== 'waiting' && phase !== 'connected')) return
    const t = setInterval(async () => {
      try {
        const s = await api.getSession(session.token)
        if (s.claimed_at && phase === 'waiting') setPhase('connected')
      } catch (e) {
        if (phase === 'connected' && (e.status === 410 || e.status === 401 || e.status === 404)) { remember(null); setSession(null); start(true) } // customer finished or cancelled
      }
    }, 2000)
    return () => clearInterval(t)
  }, [session, phase, start])

  const cancel = async () => {
    try { if (session) await api.endSession(session.token) } catch { /* already over */ }
    remember(null); setSession(null); start(true)
  }

  const expired = session && phase === 'waiting' && left === 0
  const url = session ? `${window.location.origin}/s/${session.token}` : ''

  const tilt = (e) => {
    const n = e.currentTarget
    if (window.matchMedia?.('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return
    const r = n.getBoundingClientRect()
    n.style.transform = `perspective(1100px) rotateY(${(((e.clientX - r.left) / r.width - 0.5) * 5).toFixed(2)}deg) rotateX(${(-((e.clientY - r.top) / r.height - 0.5) * 4).toFixed(2)}deg)`
  }
  const statusText = phase === 'connected' ? 'Phone connected' : expired ? 'Expired' : 'Printer ready'
  const statusTone = expired ? 'bg-[#fff1d6] text-[#9a5b00]' : 'bg-[#dcf6ec] text-[#0b7a5c]'
  const STEPS = [[ScanLine, 'Scan', 'from-[#9a80ff] to-[#5a3fd0]'], [UploadCloud, 'Upload', 'from-[#7aa7ff] to-[#3f6fe0]'], [Wallet, 'Pay', 'from-[#6ee7b7] to-[#0f9d74]'], [Printer, 'Print', 'from-[#ff9fbb] to-[#ec4a78]']]

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-4">
      <Backdrop />
      <HelpButton floating />
      <main onPointerMove={tilt} onPointerLeave={(e) => { e.currentTarget.style.transform = '' }}
        className="clay animate-card-in relative z-10 w-full max-w-xl rounded-[36px] p-6 text-center transition-transform duration-200 ease-out sm:p-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Logo size={40} full tagline />
          <span role="status" className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.8125rem] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,.8),0_4px_10px_-4px_rgba(74,50,184,.25)] ${statusTone}`}>
            <i className="relative grid size-2.5 place-items-center"><i className="absolute inset-0 animate-ripple rounded-full bg-current opacity-60" /><i className="size-2 rounded-full bg-current" /></i>
            {statusText}
          </span>
        </div>
        {phase !== 'connected' && (<>
          <h1 className="m-0 animate-rise text-[clamp(1.5rem,4.2vw,2rem)] font-extrabold leading-tight tracking-tight">Scan to start <span className="bg-gradient-to-r from-[#7c5cfc] to-[#ec4a78] bg-clip-text text-transparent">printing</span></h1>
          <p className="mb-5 mt-2 animate-rise text-[var(--muted)] [animation-delay:.08s]">Point your phone camera at the code. No app to install.</p>
        </>)}

        {phase === 'error' && (
          <div role="alert" className="rounded-2xl bg-[#ffe9ee] p-3.5 text-danger">
            <p className="m-0 font-bold">We couldn't show the code just now.</p>
            <p className="m-0 mt-1 text-sm">{problem === 404 ? 'This printer is switched off. Ask the owner to switch it on in the admin page.'
              : problem === 429 ? 'Too many tries in a short time. Please wait a minute. We will try again by ourselves.'
              : problem === 0 ? 'The printer service cannot be reached. Check that the internet and the server are on. We will try again by ourselves.'
              : 'Something went wrong on our side. We will try again by ourselves in a few seconds.'}</p>
          </div>
        )}
        {phase === 'creating' && <div className="mx-auto size-[15.75rem] animate-pulse rounded-3xl bg-[var(--hi)]" role="status" aria-label="Getting your code ready" />}
        {session && phase === 'waiting' && (
          <div className={`relative mx-auto w-fit animate-pop ${expired ? 'opacity-30' : ''}`}>
            <span aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#cdbfff] to-[#ffd5e2] opacity-70 blur-2xl" />
            <div className="relative rounded-[28px] bg-white p-4 shadow-[inset_0_2px_0_#fff,0_0_0_6px_#ece6ff,0_24px_40px_-14px_rgba(74,50,184,.45)] animate-pulse-ring">
              {['left-1.5 top-1.5 border-l-4 border-t-4 rounded-tl-2xl', 'right-1.5 top-1.5 border-r-4 border-t-4 rounded-tr-2xl', 'bottom-1.5 left-1.5 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-1.5 right-1.5 border-b-4 border-r-4 rounded-br-2xl'].map((c) => <i key={c} aria-hidden="true" className={`absolute size-7 border-[#7c5cfc] ${c}`} />)}
              <QRCodeSVG value={url} size={224} level="M" fgColor="#1f1b3d" bgColor="#ffffff" title="QR code to scan" />
              {!expired && <i aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-4 h-1 animate-[scan_2.8s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-[#7c5cfc] to-transparent shadow-[0_0_14px_3px_rgba(124,92,252,.55)]" />}
            </div>
          </div>
        )}
        {session && phase === 'connected' && (
          <div className="relative mx-auto grid w-full max-w-sm place-items-center gap-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#efe9ff] to-[#e2d9ff] px-5 py-8 shadow-[inset_0_2px_0_rgba(255,255,255,.9),inset_0_-10px_20px_rgba(124,92,252,.1)]" role="status">
            <span className="relative grid size-24 place-items-center">
              {[0, 0.8].map((d) => <i key={d} aria-hidden="true" className="absolute inset-0 animate-ripple rounded-full border-2 border-[#9a80ff]" style={{ animationDelay: `${d}s` }} />)}
              <span className="orb3d grid size-20 animate-bob place-items-center rounded-full text-white"><Smartphone size={36} aria-hidden="true" /></span>
            </span>
            <p className="m-0 mt-2 text-xl font-extrabold">Someone is using this printer</p>
            <p className="m-0 text-sm text-[var(--muted)]">They are choosing files and paying on their phone. Please wait a moment. This screen shows a new code when they finish.</p>
            <span aria-hidden="true" className="mt-1 flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="size-2 animate-bob rounded-full bg-[#7c5cfc]" style={{ animationDelay: `${i * 0.18}s` }} />)}</span>
          </div>
        )}
        {session && !expired && phase === 'waiting' && <p className="mt-4 text-sm text-[var(--muted)]">Code valid for <b className="rounded-full bg-[#ece6ff] px-2 py-0.5 text-[var(--text)]">{mmss(left)}</b></p>}
        {phase === 'connected' && (
          <>
            <div className="mt-5 flex"><Button variant="danger" onClick={cancel}><X size={20} aria-hidden="true" />Stop and show a new code</Button></div>
            <p className="mb-0 mt-3 text-xs text-[var(--muted)]">Use this only if the person has left.</p>
          </>
        )}
        {(expired || phase === 'error') && <div className="mt-5 flex"><Button onClick={() => { remember(null); start(true) }}><RefreshCw size={20} aria-hidden="true" />Get a new code</Button></div>}

        <ol className="m-0 mt-6 grid list-none grid-cols-4 gap-2 border-t border-dashed border-[var(--border)] p-0 pt-5" aria-label="How it works">
          {STEPS.map(([Icon, label, tint], i) => (
            <li key={label} className="lift flex animate-rise flex-col items-center gap-1.5 rounded-2xl py-1 text-sm font-bold" style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
              <span className={`tile3d grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-white ${tint}`}><Icon size={20} aria-hidden="true" /></span>{label}
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
