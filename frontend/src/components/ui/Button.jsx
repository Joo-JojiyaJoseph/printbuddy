const variants = {
  primary: 'cta text-white bg-gradient-to-r from-accent-2 via-[#0C6670] to-accent-2 shadow-[0_10px_26px_rgba(10,74,82,.35)]',
  pay: 'cta text-white bg-gradient-to-r from-coral-deep via-[#E24A26] to-coral-deep shadow-[0_10px_26px_rgba(214,64,31,.35)]',
  ghost: 'text-[var(--text)] bg-white border border-[var(--border)] shadow-sm',
  danger: 'text-white bg-danger',
}

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative min-h-[48px] flex-1 overflow-hidden rounded-[var(--radius-btn)] px-3 text-[15px] leading-tight sm:px-5 font-bold transition-transform duration-100 active:scale-95 disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
