import { useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { ACCEPT } from '../utils/fileValidation'

export default function UploadZone({ onFiles, disabled = false }) {
  const [over, setOver] = useState(false)
  const pick = (list) => { if (list?.length) onFiles(Array.from(list)) }
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files) }}
      className={`flex min-h-[170px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed p-6 text-center transition-colors focus-within:outline focus-within:outline-[3px] focus-within:outline-accent ${
        over ? 'border-accent bg-accent/10' : 'border-[var(--border)] bg-[var(--card)]'} ${disabled ? 'opacity-50' : ''}`}>
      <UploadCloud aria-hidden="true" size={36} className="text-accent" />
      <span className="text-base font-extrabold">Tap to choose files</span>
      <span className="text-sm text-[var(--muted)]">or drop them here · PDF, images, Word, Excel, PowerPoint, text</span>
      <input type="file" multiple accept={ACCEPT} disabled={disabled} className="sr-only" aria-label="Choose files to upload"
        onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
    </label>
  )
}
