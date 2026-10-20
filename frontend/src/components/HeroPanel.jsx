import { useRef } from 'react'
import { FileText, ShieldCheck, Zap } from 'lucide-react'

const FEATURES = [
  { icon: Zap, title: 'Fast & easy', text: 'Upload and print in a few taps', tint: 'bg-[#e6dfff] text-[#4a32b8]' },
  { icon: ShieldCheck, title: 'Secure payment', text: 'UPI, confirmed by our server', tint: 'bg-[#dcf6ec] text-[#0f8f68]' },
  { icon: FileText, title: 'Many formats', text: 'PDF, photos, Word, Excel, PowerPoint', tint: 'bg-[#e0d8fb] text-[#7c5cfc]' },
]

/**
 * Illustration: a soft 3D (clay) scene drawn with gradients, original artwork. A printer feeds out a sheet, a phone with a QR
 * hovers beside it, and file chips float around. The whole scene leans gently towards the pointer.
 */
function PrinterArt() {
  const scene = useRef(null)
  const lean = (e) => {
    const el = scene.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${(x * 14).toFixed(1)}deg) rotateX(${(-y * 10).toFixed(1)}deg)`
  }
  const rest = () => { if (scene.current) scene.current.style.transform = '' }
  return (
    <div onPointerMove={lean} onPointerLeave={rest} className="mx-auto w-full max-w-[26rem] [perspective:900px]">
      <svg ref={scene} viewBox="0 0 420 320" role="img" aria-label="A printer printing a page while a phone and file icons float beside it" className="block w-full overflow-visible transition-transform duration-200 ease-out" style={{ transformStyle: 'preserve-3d' }}>
        <defs>
          <linearGradient id="h-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9ceff" /></linearGradient>
          <linearGradient id="h-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a08aff" /><stop offset="1" stopColor="#5a3fd0" /></linearGradient>
          <linearGradient id="h-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfaeff" /><stop offset="1" stopColor="#8b6dff" /></linearGradient>
          <linearGradient id="h-phone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e3dcf8" /></linearGradient>
          <linearGradient id="h-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb3c8" /><stop offset="1" stopColor="#ff6f95" /></linearGradient>
          <linearGradient id="h-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a5d3ff" /><stop offset="1" stopColor="#6aa9ff" /></linearGradient>
          <radialGradient id="h-ball" cx=".32" cy=".28" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".25" stopColor="#d7cbff" /><stop offset="1" stopColor="#6a4be0" /></radialGradient>
          <filter id="h-soft" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="10" /></filter>
          <clipPath id="h-out"><rect x="0" y="196" width="420" height="140" /></clipPath>
        </defs>
        <ellipse cx="190" cy="292" rx="150" ry="16" fill="#4a32b8" opacity=".22" filter="url(#h-soft)" />
        {/* the sheet feeding out below the printer */}
        <g clipPath="url(#h-out)">
          <g className="animate-feed" style={{ '--feed': '56px' }}>
            <rect x="112" y="110" width="156" height="150" rx="8" fill="#fff" stroke="#e2dcf7" strokeWidth="2" />
            <rect x="130" y="206" width="84" height="8" rx="4" fill="#cdbfff" /><rect x="130" y="224" width="112" height="8" rx="4" fill="#e0d8fb" />
            <rect x="130" y="242" width="64" height="8" rx="4" fill="#ffd5e2" /><rect x="130" y="260" width="96" height="8" rx="4" fill="#e0d8fb" />
          </g>
        </g>
        {/* printer: dark underside, glossy body, lit lid */}
        <rect x="52" y="152" width="276" height="62" rx="30" fill="#4a32b8" opacity=".35" />
        <rect x="48" y="128" width="284" height="84" rx="32" fill="url(#h-body)" stroke="#fff" strokeWidth="2" />
        <rect x="48" y="176" width="284" height="36" rx="18" fill="url(#h-side)" opacity=".55" />
        <rect x="70" y="92" width="240" height="52" rx="24" fill="url(#h-top)" />
        <rect x="84" y="98" width="212" height="10" rx="5" fill="#fff" opacity=".35" />
        <rect x="92" y="190" width="196" height="12" rx="6" fill="#2a1a73" opacity=".85" />
        <circle cx="296" cy="160" r="7" fill="#6ee7b7" className="animate-bob" /><circle cx="296" cy="160" r="14" fill="#6ee7b7" opacity=".3" className="animate-ripple" style={{ transformOrigin: '296px 160px' }} />
        {/* phone with a QR, floating */}
        <g className="animate-bob" style={{ animationDuration: '3.4s' }}>
          <g transform="rotate(9 352 120)">
            <rect x="318" y="34" width="86" height="148" rx="20" fill="#4a32b8" opacity=".25" transform="translate(6 14)" filter="url(#h-soft)" />
            <rect x="316" y="30" width="88" height="150" rx="20" fill="url(#h-phone)" stroke="#fff" strokeWidth="2" />
            <rect x="324" y="46" width="72" height="104" rx="12" fill="#f3efff" />
            <rect x="334" y="56" width="22" height="22" rx="4" fill="#4a32b8" /><rect x="338" y="60" width="14" height="14" rx="2" fill="#fff" /><rect x="342" y="64" width="6" height="6" rx="1" fill="#4a32b8" />
            <rect x="362" y="56" width="22" height="22" rx="4" fill="#7c5cfc" /><rect x="334" y="84" width="22" height="22" rx="4" fill="#7c5cfc" />
            <rect x="362" y="84" width="8" height="8" rx="2" fill="#ff7a9c" /><rect x="374" y="84" width="8" height="8" rx="2" fill="#4a32b8" /><rect x="362" y="96" width="8" height="8" rx="2" fill="#4a32b8" />
            <rect x="334" y="114" width="50" height="22" rx="11" fill="url(#h-pink)" /><rect x="344" y="122" width="30" height="6" rx="3" fill="#fff" opacity=".9" />
            <rect x="346" y="164" width="30" height="5" rx="2.5" fill="#cdbfff" />
          </g>
        </g>
        {/* floating file chips and a glass ball */}
        <g className="animate-bob" style={{ animationDuration: '2.8s', animationDelay: '-.6s' }}>
          <g transform="rotate(-12 54 70)"><rect x="24" y="36" width="64" height="64" rx="18" fill="url(#h-pink)" /><rect x="28" y="40" width="56" height="12" rx="6" fill="#fff" opacity=".3" /><text x="56" y="76" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff">PDF</text></g>
        </g>
        <g className="animate-bob" style={{ animationDuration: '3.8s', animationDelay: '-1.4s' }}>
          <g transform="rotate(8 160 42)"><rect x="130" y="14" width="60" height="60" rx="18" fill="url(#h-blue)" /><rect x="134" y="18" width="52" height="11" rx="5.5" fill="#fff" opacity=".35" /><path d="M141 62l15-17 11 12 7-8 9 13z" fill="#fff" opacity=".95" /><circle cx="172" cy="34" r="5" fill="#fff" /></g>
        </g>
        <g className="animate-bob" style={{ animationDuration: '3.1s', animationDelay: '-2s' }}>
          <circle cx="250" cy="52" r="24" fill="url(#h-ball)" />
        </g>
      </svg>
    </div>
  )
}

export default function HeroPanel() {
  return (
    <aside className="hidden flex-col justify-center lg:flex lg:justify-self-start" aria-label="About Taprint">
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[var(--text)] shadow-sm">
        <i className="size-2.5 rounded-full bg-mint" /> Printer ready
      </span>
      <h1 className="mb-2 mt-5 text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-tight">
        Print anything,<br />in <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">seconds.</span>
      </h1>
      <p className="m-0 max-w-md text-[0.9987rem] leading-relaxed text-[var(--muted)]">Upload your files, choose your print options, pay securely and collect. No app to install.</p>
      <PrinterArt />
      <ul className="stagger m-0 mt-2 grid list-none gap-3 p-0">
        {FEATURES.map(({ icon: Icon, title, text, tint }) => (
          <li key={title} className="lift flex items-center gap-3 rounded-2xl p-1.5">
            <span className={`tile3d grid size-12 flex-none place-items-center rounded-2xl ${tint}`}><Icon size={22} aria-hidden="true" /></span>
            <span><b className="block text-[0.9987rem]">{title}</b><span className="text-[0.9375rem] text-[var(--muted)]">{text}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
