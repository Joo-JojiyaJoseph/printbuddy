import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Glass pop-up: blurred backdrop, scale-in animation, Esc / backdrop click to close, focus moves inside. */
export default function Modal({ open, onClose, title, children, size = 'sm', closable = true }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    ref.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape' && closable) onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.() }
  }, [open, onClose, closable])
  if (!open) return null
  // Rendered on <body> so no card, blur or stacking context in the page can cover or clip it.
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10242B]/45 p-4 backdrop-blur-md animate-fade" onMouseDown={() => closable && onClose?.()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`relative max-h-[90dvh] w-full overflow-y-auto rounded-[28px] border border-white/70 bg-white/97 p-5 shadow-[0_30px_80px_rgba(16,36,43,.35)] backdrop-blur-2xl outline-none animate-pop ${size === 'lg' ? 'max-w-2xl' : 'max-w-sm'}`}>
        {closable && (
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hi)]"><X size={20} aria-hidden="true" /></button>
        )}
        {title && <h2 className="m-0 min-w-0 pr-10 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  )
}
