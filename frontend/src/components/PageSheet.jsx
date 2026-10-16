import { useEffect, useState } from 'react'
import PdfCanvas from './PdfCanvas'
import MarksLayer, { StampLayer } from './MarksLayer'
import { pictureRect } from '../utils/marks'

// Where the page sits on the paper. Fit/Fill scale to the sheet; Centre and Top-left keep it smaller.
const BOX = {
  fit: { inset: '4%' },
  edge: { inset: 0 }, // whole page to the sheet edge (the printer's "Fit" scaling for unedited documents)
  fill: { inset: 0 },
  center: { left: '12.5%', top: '12.5%', width: '75%', height: '75%' },
  tl: { left: 0, top: 0, width: '75%', height: '75%' },
}

/** One printed sheet showing a source page (or a blank) with its rotation and position applied. */
/** Real size of a page in mm (after its rotation): drives "Actual size" and where marks sit on the sheet. */
export function usePageMm(pdf, src, rot) {
  const [mm, setMm] = useState(null)
  useEffect(() => {
    if (!pdf || !src) { setMm(null); return undefined }
    let off = false
    pdf.getPage(src).then((p) => {
      const v = p.getViewport({ scale: 1, rotation: (p.rotate + rot) % 360 })
      if (!off) setMm([(v.width * 25.4) / 72, (v.height * 25.4) / 72])
    }).catch(() => {})
    return () => { off = true }
  }, [pdf, src, rot])
  return mm
}

export default function PageSheet({ pdf, item, ratio, paperMm, renderWidth = 400, lazy = false, grayscale = false, number, label, className = '', stamp = null, total = 0 }) {
  const align = item?.align ?? 'fit'
  const mm = usePageMm(pdf, item?.src, item?.rot ?? 0)
  const marks = item?.marks ?? []
  // Marks sit on the picture itself, wherever the chosen position/scaling puts it on the sheet.
  const rect = marks.length ? (item?.src == null ? { left: 0, top: 0, width: 1, height: 1 } : mm ? pictureRect(align, ratio, mm[0] / mm[1], { paperMm, pageMm: mm }) : null) : null
  // Actual size: the page at its real size, centred on the sheet (anything bigger than the sheet is cut off, as on paper).
  const box = align === 'actual'
    ? (mm && paperMm ? { left: '50%', top: '50%', width: `${(mm[0] / paperMm[0]) * 100}%`, height: `${(mm[1] / paperMm[1]) * 100}%`, transform: 'translate(-50%,-50%)' } : BOX.edge)
    : BOX[align]
  return (
    <div role="img" aria-label={label}
      style={{ aspectRatio: ratio, filter: grayscale ? 'grayscale(1)' : undefined }}
      className={`relative w-full overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)] ${className}`}>
      {item?.src == null ? (
        <span className="absolute inset-0 grid place-items-center text-xs text-[#aaa]">Blank</span>
      ) : (
        <div className="absolute transition-all duration-300 motion-reduce:transition-none" style={box}>
          {!pdf && <span className="absolute inset-0 animate-pulse bg-[#eee]" role="status" aria-label="Loading page" />}
          <PdfCanvas pdf={pdf} page={item.src} rotation={item.rot} width={renderWidth} lazy={lazy}
            className={`h-full w-full ${align === 'fill' ? 'object-cover' : 'object-contain'}`} />
        </div>
      )}
      {rect && <MarksLayer marks={marks} rect={rect} />}
      <StampLayer stamp={stamp} number={number} total={total} />
      {number != null && <span className="absolute bottom-[3px] right-1.5 text-[10px] text-[#999]">{number}</span>}
    </div>
  )
}
