import { useState } from 'react'
import { Camera, CloudUpload, FolderOpen, Images, ShieldCheck } from 'lucide-react'
import { ACCEPT } from '../utils/fileValidation'

/** Drop area (reference layout): big target, "Choose files" button, quick Photos / Scan buttons and a privacy note. */
export default function UploadZone({ onFiles, disabled = false, compact = false }) {
  const [over, setOver] = useState(false)
  const pick = (list) => { if (list?.length) onFiles(Array.from(list)) }
  const quick = `flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-3 text-[15px] font-bold shadow-sm transition-colors hover:bg-[var(--hi)] focus-within:outline focus-within:outline-[3px] focus-within:outline-accent ${disabled ? 'opacity-50' : ''}`
  if (compact) {
    // Files are already added: one tidy row instead of a big drop area.
    const c = `flex min-h-[64px] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--border)] bg-white px-2 text-[0.8125rem] font-bold shadow-sm transition-colors hover:bg-[var(--hi)] focus-within:outline focus-within:outline-[3px] focus-within:outline-accent ${disabled ? 'opacity-50' : ''}`
    return (
      <div className="flex gap-2.5">
        <label className={c}><FolderOpen size={22} aria-hidden="true" className="text-accent-2" />Add files
          <input type="file" multiple accept={ACCEPT} disabled={disabled} className="sr-only" aria-label="Choose files to upload" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
        <label className={c}><Images size={22} aria-hidden="true" className="text-accent" />Photos
          <input type="file" multiple accept="image/jpeg,image/png" disabled={disabled} className="sr-only" aria-label="Choose photos or media from your device" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
        <label className={c}><Camera size={22} aria-hidden="true" className="text-accent-2" />Scan
          <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={disabled} className="sr-only" aria-label="Scan a document with the camera" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
      </div>
    )
  }
  return (
    <>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files) }}
        className={`flex min-h-[230px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[26px] border-2 border-dashed p-6 text-center transition-colors focus-within:outline focus-within:outline-[3px] focus-within:outline-accent ${
          over ? 'border-accent bg-[#e3f3f3]' : 'border-[#86cbd0] bg-[#f6fbfb]'} ${disabled ? 'opacity-50' : ''}`}>
        <CloudUpload aria-hidden="true" size={56} strokeWidth={1.6} className="text-accent-2" />
        <span className="mt-1 text-lg font-bold">Drop your files here</span>
        <span className="text-[15px]">or tap to browse</span>
        <span className="mt-1 text-xs text-[var(--muted)]">PDF, photos, Word, Excel, PowerPoint</span>
        <span className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-2 px-7 text-base font-bold text-white shadow-[0_10px_26px_rgba(10,74,82,.3)]">
          <FolderOpen size={20} aria-hidden="true" /> Choose files
        </span>
        <input type="file" multiple accept={ACCEPT} disabled={disabled} className="sr-only" aria-label="Choose files to upload"
          onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </label>

      <div className="my-3 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)]" aria-hidden="true">
        <i className="h-px flex-1 bg-[var(--border)]" /> or <i className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="flex gap-2.5">
        <label className={quick}>
          <Images aria-hidden="true" size={20} className="text-accent" /> Photos &amp; media
          <input type="file" multiple accept="image/jpeg,image/png" disabled={disabled} className="sr-only" aria-label="Choose photos or media from your device"
            onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
        <label className={quick}>
          <Camera aria-hidden="true" size={20} className="text-accent-2" /> Scan a page
          {/* capture opens the rear camera on phones/tablets; on a computer it falls back to the normal file picker */}
          <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={disabled} className="sr-only" aria-label="Scan a document with the camera"
            onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
      </div>
      <p className="mb-0 mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--muted)]" role="note">
        <ShieldCheck size={14} aria-hidden="true" className="text-mint" /> Private to this phone. Files are erased after printing.
      </p>
    </>
  )
}
