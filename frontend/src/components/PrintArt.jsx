/**
 * The finish screen's picture: a printer that feeds a sheet out while the job runs, shows the finished sheet with a tick when
 * it is sent, and a stuck sheet with a warning when it needs help. Decorative (the words next to it say the same thing).
 */
export default function PrintArt({ state = 'printing' }) {
  const feeding = state === 'printing'
  return (
    <svg viewBox="0 0 260 210" aria-hidden="true" className="mx-auto block w-full animate-[tilt-float_6s_ease-in-out_infinite] [--r:0deg]" style={{ maxWidth: "15rem" }}>
      <defs>
        <clipPath id="pa-out"><rect x="0" y="122" width="260" height="90" /></clipPath>
        <linearGradient id="pa-body2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfc2fb" /></linearGradient>
        <linearGradient id="pa-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a08aff" /><stop offset="1" stopColor="#5a3fd0" /></linearGradient>
        <filter id="pa-blur"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <ellipse cx="130" cy="198" rx="104" ry="9" fill="#4a32b8" opacity=".25" filter="url(#pa-blur)" />
      {/* the sheet comes out below the printer */}
      <g clipPath="url(#pa-out)">
        <g className={feeding ? 'animate-feed' : ''} style={{ '--feed': '44px', transform: feeding ? undefined : `translateY(${state === 'failed' ? 10 : 44}px)` }}>
          <rect x="82" y="40" width="96" height="112" rx="5" fill="#fff" stroke="#d9d0f5" strokeWidth="2" />
          <rect x="94" y="132" width="52" height="5" rx="2.5" fill="#cdbfff" />
          <rect x="94" y="144" width="70" height="5" rx="2.5" fill="#ddd4fb" />
          <rect x="94" y="156" width="40" height="5" rx="2.5" fill="#ddd4fb" />
          <rect x="94" y="168" width="62" height="5" rx="2.5" fill="#ddd4fb" />
        </g>
      </g>
      {/* printer */}
      <rect x="40" y="62" width="180" height="62" rx="18" fill="url(#pa-body2)" stroke="#fff" strokeWidth="2" />
      <rect x="40" y="100" width="180" height="24" rx="12" fill="#8b6dff" opacity=".35" />
      <rect x="62" y="50" width="136" height="22" rx="11" fill="url(#pa-lid)" /><rect x="70" y="54" width="120" height="5" rx="2.5" fill="#fff" opacity=".35" />
      <rect x="62" y="108" width="136" height="10" rx="5" fill="#4a32b8" opacity=".85" />
      <circle cx="198" cy="88" r="5" fill={state === 'failed' ? '#d97706' : state === 'sent' ? '#12a679' : '#2fb5ff'} className={feeding ? 'animate-bob' : ''} />
      {state === 'sent' && (
        <g className="animate-pop" style={{ transformOrigin: '186px 158px' }}>
          <circle cx="186" cy="158" r="22" fill="#12a679" />
          <path d="M175 158.5l8 8 14-15" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {state === 'failed' && (
        <g className="animate-pop" style={{ transformOrigin: '186px 156px' }}>
          <path d="M186 134l24 42h-48z" fill="#d97706" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
          <rect x="184" y="147" width="4" height="14" rx="2" fill="#fff" /><circle cx="186" cy="168" r="2.6" fill="#fff" />
        </g>
      )}
    </svg>
  )
}
