const COLORS = ['#7c5cfc', '#4a32b8', '#12a679', '#ec4899', '#f59e0b', '#cdbfff']

/** A short burst of falling confetti (decorative; hidden from screen readers; off when the device asks for less motion). */
export default function Confetti({ count = 28 }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="absolute block h-3 w-2 rounded-[2px] animate-fall"
          style={{ left: `${(i * 37) % 95}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2 + (i % 5) * 0.3}s` }} />
      ))}
    </div>
  )
}
