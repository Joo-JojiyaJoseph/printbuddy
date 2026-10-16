import { gridFor, PAGES_PER_SHEET } from '../utils/pagePlan'

/** Tiny picture of how many pages share a sheet. */
export function GridIcon({ n, landscape = false, size = 26 }) {
  const [cols, rows] = gridFor(n, landscape)
  const w = landscape ? size * 1.3 : size, h = landscape ? size : size * 1.3
  const gap = 2, pad = 2
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols, ch = (h - pad * 2 - gap * (rows - 1)) / rows
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-none">
      <rect x=".5" y=".5" width={w - 1} height={h - 1} rx="3" fill="#fff" stroke="currentColor" strokeWidth="1" opacity=".5" />
      {Array.from({ length: cols * rows }, (_, i) => (
        <rect key={i} x={pad + (i % cols) * (cw + gap)} y={pad + Math.floor(i / cols) * (ch + gap)} width={cw} height={ch} rx="1" fill="currentColor" opacity=".75" />
      ))}
    </svg>
  )
}

/** "Pages per sheet" chooser for documents and slides: 1, 2, 4, 6 or 9 on one sheet. */
export default function PerSheetPicker({ value, onChange, orientation = 'portrait', pageCount = 0 }) {
  const landscape = orientation === 'landscape'
  return (
    <div role="radiogroup" aria-label="Pages per sheet" className="grid grid-cols-5 gap-1.5">
      {PAGES_PER_SHEET.map((n) => {
        const on = value === n
        return (
          <button key={n} type="button" role="radio" aria-checked={on} aria-label={n === 1 ? '1 page per sheet' : `${n} pages per sheet`}
            onClick={() => onChange(n)}
            className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] px-1 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
              on ? 'border-accent-2 bg-[#dcf0f1] text-primary shadow-[0_4px_14px_rgba(10,74,82,.18)]' : 'border-[var(--border)] bg-white text-[var(--muted)] hover:-translate-y-0.5 hover:shadow-sm'}`}>
            <GridIcon n={n} landscape={n === 1 ? false : landscape} />
            <span>{n}</span>
          </button>
        )
      })}
    </div>
  )
}
