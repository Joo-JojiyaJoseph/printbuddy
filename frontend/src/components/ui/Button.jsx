const variants = {
  primary: 'cta b3d text-white bg-gradient-to-b from-[#9a80ff] via-[#7c5cfc] to-[#6a4be0]',
  pay: 'cta b3d text-white bg-gradient-to-b from-[#ff8fb0] via-[#ec4a78] to-[#d93a66] [--edge:#a82552] [--glow:rgba(217,58,102,.4)]',
  ghost: 'b3d text-[var(--text)] bg-gradient-to-b from-white to-[#f1ecff] border border-[#d6cdf3] [--edge:#c2b6ec] [--glow:rgba(74,50,184,.14)]',
  danger: 'b3d text-white bg-gradient-to-b from-[#ef6b7e] to-[#d9344a] [--edge:#9c2034] [--glow:rgba(217,52,74,.4)]',
}

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative min-h-[3.5rem] flex-1 overflow-hidden rounded-[var(--radius-btn)] px-4 text-[0.9987rem] leading-tight sm:px-6 font-bold disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
