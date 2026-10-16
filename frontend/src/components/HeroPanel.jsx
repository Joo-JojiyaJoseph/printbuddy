import { FileText, ShieldCheck, Zap } from 'lucide-react'

const FEATURES = [
  { icon: Zap, title: 'Fast & easy', text: 'Upload and print in a few taps', tint: 'bg-[#dcf0f1] text-[#0A4A52]' },
  { icon: ShieldCheck, title: 'Secure payment', text: 'UPI, confirmed by our server', tint: 'bg-[#dcf6ec] text-[#0f8f68]' },
  { icon: FileText, title: 'Many formats', text: 'PDF, photos, Word, Excel, PowerPoint', tint: 'bg-[#d0eced] text-[#0E7C86]' },
]

/** Illustration: original printer artwork (inline SVG, no external image). */
function PrinterArt() {
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label="A printer printing a photo" className="mx-auto w-full max-w-[23.75rem]">
      <defs>
        <linearGradient id="pa-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e3e8d0" /></linearGradient>
        <linearGradient id="pa-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fdadd" /><stop offset="1" stopColor="#e3f3f3" /></linearGradient>
      </defs>
      <ellipse cx="180" cy="236" rx="140" ry="14" fill="#0A4A52" opacity=".12" />
      <g className="animate-float" style={{ transformOrigin: '60px 60px' }}>
        <rect x="36" y="22" width="46" height="56" rx="8" fill="#ff6b6b" transform="rotate(-10 60 50)" /><text x="46" y="62" fontSize="15" fontWeight="800" fill="#fff" transform="rotate(-10 60 50)">PDF</text>
      </g>
      <rect x="150" y="10" width="52" height="46" rx="10" fill="#0E7C86" /><path d="M158 46l14-16 10 12 6-7 8 11z" fill="#fff" opacity=".9" />
      <rect x="236" y="36" width="46" height="56" rx="8" fill="#14b88a" transform="rotate(8 260 64)" /><text x="251" y="72" fontSize="22" fontWeight="800" fill="#fff" transform="rotate(8 260 64)">T</text>
      <rect x="64" y="104" width="232" height="86" rx="22" fill="url(#pa-body)" stroke="#c8e1e3" strokeWidth="2" />
      <rect x="86" y="92" width="188" height="24" rx="8" fill="#10242B" />
      <circle cx="250" cy="150" r="5" fill="#2fb5ff" />
      <rect x="92" y="168" width="176" height="14" rx="7" fill="#c9d0f3" />
      <g transform="rotate(-6 180 205)">
        <rect x="104" y="170" width="152" height="62" rx="6" fill="#fff" stroke="#c8e1e3" strokeWidth="2" />
        <rect x="112" y="178" width="136" height="46" rx="4" fill="url(#pa-sky)" />
        <path d="M112 224l36-34 24 22 20-14 56 26z" fill="#2f9e6e" /><circle cx="226" cy="192" r="6" fill="#ffc94d" />
      </g>
    </svg>
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
      <p className="m-0 max-w-md text-[0.9375rem] leading-relaxed text-[var(--muted)]">Upload your files, choose your print options, pay securely and collect. No app to install.</p>
      <PrinterArt />
      <ul className="stagger m-0 mt-2 grid list-none gap-3 p-0">
        {FEATURES.map(({ icon: Icon, title, text, tint }) => (
          <li key={title} className="flex items-center gap-3">
            <span className={`grid size-11 flex-none place-items-center rounded-2xl ${tint}`}><Icon size={22} aria-hidden="true" /></span>
            <span><b className="block text-[0.9375rem]">{title}</b><span className="text-[0.8125rem] text-[var(--muted)]">{text}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
