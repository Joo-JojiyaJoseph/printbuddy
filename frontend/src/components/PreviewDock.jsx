import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import Modal from './ui/Modal'

/**
 * Keeps the document in view while the customer changes options.
 * Phone: a slim bar pinned to the top of the screen, small preview on the left, page controls and a one-line summary
 * on the right; tapping the preview opens it full size. Tablet/desktop: the usual big preview in the left column.
 * `preview` is the already-built preview element; `after` is anything that should scroll normally under the bar.
 * `interactive`: the preview can be dragged on (tablet/desktop). On a phone it is too small for that, so it stays a thumbnail
 * that opens the big view and the page offers its own larger drag area.
 * On tablet/desktop the whole dock (preview, page strip) stays on screen while the options scroll.
 */
export default function PreviewDock({ preview, children, after, title = 'Preview', interactive = false, mdClass = 'md:w-full md:max-w-[min(23.75rem,max(14rem,calc((100dvh-27rem)/1.45)))]' }) {
  const [big, setBig] = useState(false)
  return (
    <div className="contents md:block md:min-w-0 md:sticky md:top-4 md:max-h-[calc(100dvh-8rem)] md:overflow-y-auto md:overflow-x-hidden md:[scrollbar-width:thin]">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-[var(--border)] bg-white px-4 py-2 shadow-[0_6px_14px_rgba(31,27,61,.06)] md:static md:mx-0 md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        {interactive ? (
          <div className={`relative w-[5.25rem] shrink-0 md:mx-auto md:py-2 ${mdClass}`}>
            <div className="pointer-events-none md:pointer-events-auto max-md:[&_[data-corner]]:hidden max-md:[&_[data-testid=resize-box]]:hidden">{preview}</div>
            <button type="button" aria-label="Enlarge preview" onClick={() => setBig(true)} className="absolute inset-0 md:hidden" />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-[#1f1b3d]/70 text-white md:hidden"><Maximize2 size={11} /></span>
          </div>
        ) : (
          <div role="button" tabIndex={0} aria-label="Enlarge preview" onClick={() => setBig(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBig(true) } }}
            className={`relative w-[5.25rem] shrink-0 cursor-zoom-in md:mx-auto md:py-2 ${mdClass}`}>
            {preview}
            <span aria-hidden="true" className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-[#1f1b3d]/70 text-white md:hidden"><Maximize2 size={11} /></span>
          </div>
        )}
        <div className="min-w-0 flex-1 md:flex-none">{children}</div>
      </div>
      {after}
      {big && (
        <Modal open onClose={() => setBig(false)} title={title} size="lg">
          <div className="mx-auto mt-3 max-w-md">{preview}</div>
        </Modal>
      )}
    </div>
  )
}
