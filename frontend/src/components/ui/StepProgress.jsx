export const STEPS = ['Connect', 'Upload', 'Edit', 'Review', 'Pay', 'Print']

export default function StepProgress({ current = 0 }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={current + 1}
         aria-label={`Step ${current + 1} of ${STEPS.length}: ${STEPS[current]}`}>
      <div className="my-2 flex gap-1.5">
        {STEPS.map((s, i) => (
          <i key={s} className={`h-[5px] flex-1 rounded-full transition-all duration-300 ${
            i < current ? 'bg-accent' : i === current ? 'bg-gradient-to-r from-primary to-pink shadow-[0_0_12px_var(--color-primary)]' : 'bg-[var(--border)]'}`} />
        ))}
      </div>
      <div className="text-xs font-bold text-[var(--muted)]">{STEPS[current]} · {current + 1}/{STEPS.length}</div>
    </div>
  )
}
