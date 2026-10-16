/**
 * Taprint logo. Original artwork: a teal printer on a deep-teal tile, a paper with a tiny QR "finder" pattern
 * going in, a printed page coming out, a coral status light and a tap ripple in the corner.
 * Brand colours: teal #0E7C86, deep teal #0A4A52, coral #FF6B4A, ink #10242B, white.
 */
export const BRAND = { teal: '#14A3AE', brand: '#0E7C86', deep: '#0A4A52', coral: '#FF6B4A', ink: '#10242B', mist: '#BFE6E8' }

export function Mark({ size = 40, title = 'Taprint' }) {
  return (
    <svg style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }} viewBox="0 0 64 64" role="img" aria-label={title} className="flex-none">
      <rect width="64" height="64" rx="16" fill={BRAND.deep} />
      {/* tap ripple */}
      <circle cx="50" cy="14" r="2.6" fill={BRAND.coral} />
      <path d="M44.5 14a5.5 5.5 0 0 1 5.5-5.5M39 14a11 11 0 0 1 11-11" fill="none" stroke={BRAND.coral} strokeWidth="2.4" strokeLinecap="round" opacity=".95" />
      {/* paper in (with QR finder) */}
      <rect x="14" y="16" width="22" height="14" rx="2.5" fill="#fff" />
      <rect x="17.5" y="19" width="6.5" height="6.5" rx="1.2" fill={BRAND.deep} />
      <rect x="19.3" y="20.8" width="2.9" height="2.9" rx=".6" fill="#fff" />
      <rect x="26" y="19" width="2.6" height="2.6" rx=".5" fill={BRAND.coral} />
      <rect x="30" y="19" width="2.6" height="2.6" rx=".5" fill={BRAND.deep} />
      <rect x="26" y="23" width="2.6" height="2.6" rx=".5" fill={BRAND.deep} />
      {/* printer body */}
      <rect x="8" y="28" width="48" height="19" rx="7" fill={BRAND.teal} />
      <circle cx="47.5" cy="35" r="2" fill={BRAND.coral} />
      {/* paper out */}
      <rect x="17" y="40" width="30" height="17" rx="2.5" fill="#fff" />
      <rect x="21" y="45" width="19" height="2.4" rx="1.2" fill={BRAND.brand} />
      <rect x="21" y="50" width="12" height="2.4" rx="1.2" fill={BRAND.mist} />
    </svg>
  )
}

/** `full` adds the word "Taprint"; `tagline` adds "Tap In. Print Out." under it. */
export default function Logo({ size = 40, full = false, tagline = false }) {
  if (!full) return <Mark size={size} />
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Mark size={size} title="" />
      <span className="flex min-w-0 flex-col items-start text-left leading-none">
        <span className="whitespace-nowrap font-extrabold tracking-tight" style={{ fontSize: `${(size * 0.58) / 16}rem`, color: BRAND.ink }}>
          Tap<span style={{ color: BRAND.brand }}>rint</span>
        </span>
        {tagline && <span className="mt-1 font-semibold text-[var(--muted)]" style={{ fontSize: `${Math.max(11, size * 0.3) / 16}rem` }}>Tap In. Print Out.</span>}
      </span>
    </span>
  )
}
