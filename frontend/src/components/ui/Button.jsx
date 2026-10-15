const variants = {
  primary: 'text-[#062a33] bg-gradient-to-br from-accent to-accent-2 shadow-[0_10px_26px_rgba(39,185,234,.4)]',
  ghost: 'text-[var(--text)] bg-[var(--card)] border border-[var(--border)] backdrop-blur-md',
  danger: 'text-white bg-danger',
}

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative min-h-[54px] flex-1 overflow-hidden rounded-[var(--radius-btn)] px-5 text-base font-extrabold transition-transform duration-100 active:scale-95 disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
