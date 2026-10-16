import { pictureRect } from '../utils/marks'

/** Static drawing of marks over the picture rectangle `rect` (fractions of the container). Sized with container units. */
export default function MarksLayer({ marks = [], rect, className = '', children }) {
  if (!rect) return null
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute overflow-visible ${className}`}
      style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, containerType: 'size' }}>
      {marks.map((m, i) => <MarkShape key={i} mark={m} />)}
      {children}
    </div>
  )
}

export function markStyle(m) {
  const base = { position: 'absolute', left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }
  if (m.t === 'cover') return { ...base, background: m.color }
  if (m.t === 'hl') return { ...base, background: m.color, opacity: 0.4 }
  return {
    ...base, background: m.cover ? '#fff' : 'transparent', color: m.color, fontWeight: m.bold ? 700 : 400,
    fontFamily: 'Helvetica, Arial, sans-serif', fontSize: `${m.fs * 100}cqh`, lineHeight: 1.2, textAlign: { l: 'left', c: 'center', r: 'right' }[m.align] ?? 'left',
    overflow: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '0 0.3%',
  }
}

function MarkShape({ mark }) {
  return <div style={markStyle(mark)}>{mark.t === 'text' ? mark.text : null}</div>
}

/** Page number and watermark preview for a whole sheet. */
export function StampLayer({ stamp, number, total }) {
  if (!stamp) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: 'size' }}>
      {stamp.watermark?.trim() && (
        <span className="absolute left-1/2 top-1/2 whitespace-nowrap font-bold" style={{ transform: 'translate(-50%,-50%) rotate(-55deg)', color: 'rgba(128,128,128,.22)', fontSize: `${Math.min(14, 70 / Math.max(4, stamp.watermark.length) * 1.6)}cqw` }}>
          {stamp.watermark}
        </span>
      )}
      {stamp.numbers && <span className="absolute inset-x-0 text-center" style={{ bottom: '1.5%', color: '#555', fontSize: '3.4cqw' }}>{number} / {total}</span>}
    </div>
  )
}

export { pictureRect }
