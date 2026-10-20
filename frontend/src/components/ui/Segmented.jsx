export default function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[2.875rem] rounded-[14px] border-[1.5px] px-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
            value === o.value ? 'border-accent-2 bg-[#e6dfff] text-primary shadow-[0_4px_14px_rgba(74,50,184,.18)]' : 'border-[var(--border)] bg-white hover:-translate-y-0.5 hover:shadow-sm'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
