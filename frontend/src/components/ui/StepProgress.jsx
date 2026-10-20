import { Check } from 'lucide-react'

/** The four things a customer does. The app's six screens map onto them, so the bar is short enough to read on any phone. */
export const PHASES = ['Upload', 'Edit', 'Review', 'Pay']
const PHASE_OF_SCREEN = [0, 0, 1, 2, 3, 4] // Connect, Upload, Edit, Review, Pay, Print(done)
export const STEPS = ['Connect', 'Upload', 'Edit', 'Review', 'Pay', 'Print']

export default function StepProgress({ current = 0 }) {
  const phase = PHASE_OF_SCREEN[current] ?? 0
  const done = phase >= PHASES.length
  const label = done ? 'Order complete' : `Step ${phase + 1} of ${PHASES.length}: ${PHASES[phase]}`
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={PHASES.length} aria-valuenow={Math.min(phase + 1, PHASES.length)} aria-label={label}>
      <ol className="m-0 flex list-none items-start p-0" aria-hidden="true">
        {PHASES.map((s, i) => (
          <li key={s} className={`flex items-start ${i < PHASES.length - 1 ? 'flex-1' : ''}`}>
            <span className="flex w-[4.5rem] flex-none flex-col items-center gap-1.5">
              <span className={`grid size-11 place-items-center rounded-full text-base font-bold transition-all duration-500 ${
                i < phase ? 'bg-mint text-white' : i === phase ? 'scale-110 bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_8px_20px_rgba(10,74,82,.45)]' : 'bg-[var(--hi)] text-[var(--muted)]'}`}>
                {i < phase ? <Check size={22} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-sm font-bold ${i === phase ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>{s}</span>
            </span>
            {i < PHASES.length - 1 && (
              <span className="relative mt-[1.25rem] h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <i className="absolute inset-y-0 left-0 block rounded-full bg-mint transition-all duration-700" style={{ width: i < phase ? '100%' : '0%' }} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
