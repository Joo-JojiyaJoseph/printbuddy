export default function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[46px] rounded-[14px] border-[1.5px] px-2 text-xs font-bold transition-colors ${
            value === o.value ? 'border-accent bg-accent/15' : 'border-[var(--border)] bg-[var(--card)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
