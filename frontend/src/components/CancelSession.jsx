import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useSession } from '../context/SessionContext'
import Modal from './ui/Modal'

/** "End session" in the header of every customer page, with a confirmation so it cannot be tapped by accident. */
export default function CancelSession() {
  const ctx = useSession()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!ctx?.endSession) return null
  const confirm = async () => { setBusy(true); try { await ctx.endSession() } finally { setBusy(false) } }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Leave and delete my files"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full glass px-3 text-sm font-bold text-[var(--text)] shadow-sm hover:bg-white">
        <LogOut size={16} aria-hidden="true" /><span className="hidden sm:inline">Exit</span>
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Leave and delete my files?" closable={!busy}>
        <p className="mb-4 mt-2 text-sm text-[var(--muted)]">Anything still uploading is stopped and your files are deleted. The printer screen will show a new QR code for the next person. If you have already paid, your print is not affected.</p>
        <div className="flex gap-2.5">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-12 flex-1 rounded-full border border-[var(--border)] bg-white font-bold">Stay</button>
          <button type="button" disabled={busy} onClick={confirm} className="min-h-12 flex-1 rounded-full bg-danger font-bold text-white disabled:opacity-60">{busy ? 'Leaving…' : 'Yes, leave'}</button>
        </div>
      </Modal>
    </>
  )
}
