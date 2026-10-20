import PdfCanvas from './PdfCanvas'
import MarksLayer, { StampLayer } from './MarksLayer'
import { usePageMm } from './PageSheet'
import { gridFor } from '../utils/pagePlan'

const WHOLE = { left: 0, top: 0, width: 1, height: 1 }

/** One page inside its cell: kept at its own shape, centred, with a hairline like the printed sheet. */
function Cell({ pdf, item, renderWidth }) {
  const mm = usePageMm(pdf, item?.src, item?.rot ?? 0)
  const ratio = item?.src == null ? 0.707 : mm ? mm[0] / mm[1] : 0.707
  return (
    <div className="relative overflow-hidden" style={{ containerType: 'size' }}>
      {item && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white outline outline-1 outline-[#b5b5b5]"
          style={{ width: `min(100cqw, ${ratio} * 100cqh)`, aspectRatio: ratio }}>
          {item.src != null && <PdfCanvas pdf={pdf} page={item.src} rotation={item.rot ?? 0} width={renderWidth} className="h-full w-full" />}
          {item.marks?.length > 0 && <MarksLayer marks={item.marks} rect={WHOLE} />}
        </div>
      )}
    </div>
  )
}

/** A printed sheet carrying several pages (slides) in reading order, exactly as the printer will lay them out. */
export default function NupSheet({ pdf, items, perSheet, ratio, paperMm, orientation, grayscale = false, stamp = null, number, total, label, renderWidth = 260 }) {
  const landscape = orientation === 'landscape'
  const [cols, rows] = gridFor(perSheet, landscape)
  const pad = `${(8 / paperMm[0]) * 100}%` // the same 8 mm gap the server uses
  return (
    <div role="img" aria-label={label} data-cells={cols * rows}
      style={{ aspectRatio: ratio, padding: pad, filter: grayscale ? 'grayscale(1)' : undefined }}
      className="relative w-full overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(31,27,61,.35)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: pad }}>
        {Array.from({ length: cols * rows }, (_, i) => <Cell key={i} pdf={pdf} item={items[i]} renderWidth={renderWidth} />)}
      </div>
      <StampLayer stamp={stamp} number={number} total={total} />
    </div>
  )
}
