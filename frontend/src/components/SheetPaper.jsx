import { gridFor, paperMm } from '../utils/pagePlan'

/** Image rotated inside a cell. Quarter turns swap the box (container-query units) so the picture still fills it. */
function CellImage({ url, name, rot, fit }) {
  const quarter = rot === 90 || rot === 270
  const common = { position: 'absolute', objectFit: fit === 'fill' ? 'cover' : 'contain' }
  const style = quarter
    ? { ...common, left: '50%', top: '50%', width: '100cqh', height: '100cqw', transform: `translate(-50%,-50%) rotate(${rot}deg)` }
    : { ...common, inset: 0, width: '100%', height: '100%', transform: rot ? `rotate(${rot}deg)` : undefined }
  return <img src={url} alt={name} style={style} draggable={false} />
}

/** One printed sheet laid out with `perPage` images, using the chosen margin, sizing and orientation. */
export default function SheetPaper({ cells, docsById, perPage, fit, margin, size, orientation, grayscale = false, label }) {
  const landscape = orientation === 'landscape'
  const [cols, rows] = gridFor(perPage, landscape)
  const [w, h] = paperMm(size, orientation)
  const pad = `${(margin / w) * 100}%`
  return (
    <div role="img" aria-label={label}
      style={{ aspectRatio: w / h, padding: pad, filter: grayscale ? 'grayscale(1)' : undefined }}
      className="relative w-full overflow-hidden rounded-[5px] bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)]">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: pad }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const cell = cells[i]
          const d = cell && docsById[cell.document_id]
          return (
            <div key={i} className="relative overflow-hidden bg-[#f4f4f8]" style={{ containerType: 'size' }}>
              {d?.preview_url && <CellImage url={d.preview_url} name={d.original_name} rot={cell.rot} fit={fit} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
