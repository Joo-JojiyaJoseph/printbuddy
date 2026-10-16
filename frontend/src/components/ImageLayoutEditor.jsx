import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, RotateCw } from 'lucide-react'
import SheetPaper from './SheetPaper'
import Segmented from './ui/Segmented'
import { PER_PAGE_OPTIONS, defaultSheet, sheetPageCount, sheetPages, toSheetEdits } from '../utils/pagePlan'

const heading = 'mb-1.5 mt-4 block text-sm font-bold'
const iconBtn = 'grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] disabled:opacity-30'

/** Several images to a sheet, copies of an image, sizing, margins and rotation for JPG/PNG. */
export default function ImageLayoutEditor({ doc, images, edits, onEdits, paper, onOrientation, seedIds = [] }) {
  // Pictures ticked on the upload page start on the same sheet (2 to a page when there is more than one).
  const [sheet, setSheet] = useState(() => {
    if (edits?.sheet) return edits.sheet
    const base = defaultSheet(doc.id)
    const extra = seedIds.filter((id) => id !== doc.id && images.some((d) => d.id === id))
    return extra.length ? { ...base, per_page: 2, images: [...base.images, ...extra.map((document_id) => ({ document_id, rot: 0 }))] } : base
  })
  useEffect(() => { if (!edits?.sheet) onEdits(toSheetEdits(sheet, doc.id)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(0)
  const byId = useMemo(() => Object.fromEntries(images.map((d) => [d.id, d])), [images])
  const selected = sheet.images.map((i) => i.document_id)
  const pages = sheetPages(sheet)
  const cur = Math.min(page, pages.length - 1)

  const update = (patch) => { const next = { ...sheet, ...patch }; setSheet(next); onEdits(toSheetEdits(next, doc.id)) }
  const toggle = (id) => {
    if (id === doc.id) return
    update({ images: selected.includes(id) ? sheet.images.filter((i) => i.document_id !== id) : [...sheet.images, { document_id: id, rot: 0 }] })
  }
  const rotate = (id, dir) => update({ images: sheet.images.map((i) => (i.document_id === id ? { ...i, rot: (i.rot + (dir > 0 ? 90 : 270)) % 360 } : i)) })
  const move = (id, d) => {
    const i = sheet.images.findIndex((x) => x.document_id === id), j = i + d
    if (j < 0 || j >= sheet.images.length) return
    const next = [...sheet.images];
    [next[i], next[j]] = [next[j], next[i]]
    update({ images: next })
  }
  const sheetsCount = sheetPageCount(sheet)
  const lonely = sheet.mode === 'sequence' && sheet.per_page > 1 && sheet.images.length === 1

  return (
    <div className="mx-auto max-w-3xl md:grid md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:gap-10">
      <div className="min-w-0 md:sticky md:top-4">
      <div className="mx-auto w-[72%] max-w-[420px] py-1 md:w-[58%] lg:w-[84%]">
        <SheetPaper cells={pages[cur] ?? []} docsById={byId} perPage={sheet.per_page} fit={sheet.fit} margin={sheet.margin}
          size={paper.size} orientation={paper.orientation} label={`Sheet ${cur + 1} preview`} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-sm font-bold text-[var(--muted)]">
        <button type="button" aria-label="Previous sheet" disabled={cur <= 0} onClick={() => setPage(cur - 1)} className={iconBtn}><ChevronLeft aria-hidden="true" /></button>
        <span>Sheet {cur + 1} of {pages.length}</span>
        <button type="button" aria-label="Next sheet" disabled={cur >= pages.length - 1} onClick={() => setPage(cur + 1)} className={iconBtn}><ChevronRight aria-hidden="true" /></button>
      </div>
      <p role="status" className="m-0 mt-1 text-center text-sm font-bold">
        {sheet.images.length} image{sheet.images.length === 1 ? '' : 's'} → {sheetsCount} sheet{sheetsCount === 1 ? '' : 's'}
      </p>
      {lonely && <p role="status" className="m-0 mt-1 text-center text-xs text-amber">Only one image is selected. Choose “Copies of each image” to repeat it, or add more images below.</p>}

      </div>
      <div className="min-w-0">
      <span className={`${heading} lg:!mt-0`}>Images per page</span>
      <Segmented label="Images per page" value={sheet.per_page} onChange={(v) => { update({ per_page: v }); setPage(0) }}
        options={PER_PAGE_OPTIONS.map((v) => ({ value: v, label: String(v) }))} />

      <span className={heading}>Layout</span>
      <Segmented label="Layout" value={sheet.mode} onChange={(v) => { update({ mode: v }); setPage(0) }}
        options={[{ value: 'sequence', label: 'Different images' }, { value: 'copies', label: 'Copies of each image' }]} />

      <span className={heading}>Sizing</span>
      <Segmented label="Sizing" value={sheet.fit} onChange={(v) => update({ fit: v })}
        options={[{ value: 'fit', label: 'Fit (whole image)' }, { value: 'fill', label: 'Fill (crop to cell)' }]} />

      <span className={heading}>Paper orientation</span>
      <Segmented label="Paper orientation" value={paper.orientation} onChange={onOrientation}
        options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />

      <label htmlFor="margin" className={heading}>Margin <span className="font-medium text-[var(--muted)]">{sheet.margin} mm</span></label>
      <input id="margin" type="range" min="0" max="20" step="1" value={sheet.margin} className="h-8 w-full accent-[var(--color-accent)]"
        onChange={(e) => update({ margin: Number(e.target.value) })} />

      <span className={heading}>Images on this sheet</span>
      <ul className="m-0 list-none space-y-2 p-0">
        {images.map((d) => {
          const on = selected.includes(d.id)
          const item = sheet.images.find((i) => i.document_id === d.id)
          const idx = sheet.images.findIndex((i) => i.document_id === d.id)
          return (
            <li key={d.id} className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2">
              <input type="checkbox" id={`img-${d.id}`} checked={on} disabled={d.id === doc.id} onChange={() => toggle(d.id)} className="size-5 accent-[var(--color-accent)]" />
              <img src={d.preview_url} alt="" className="size-10 rounded-lg bg-white object-cover" style={{ transform: item?.rot ? `rotate(${item.rot}deg)` : undefined }} />
              <label htmlFor={`img-${d.id}`} className="min-w-0 flex-1 truncate text-sm font-bold">{d.original_name}{d.id === doc.id ? ' (this one)' : ''}</label>
              {on && (
                <span className="flex gap-1">
                  <button type="button" aria-label={`Rotate ${d.original_name} left`} onClick={() => rotate(d.id, -1)} className={iconBtn}><RotateCcw size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Rotate ${d.original_name} right`} onClick={() => rotate(d.id, 1)} className={iconBtn}><RotateCw size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Move ${d.original_name} earlier`} disabled={idx === 0} onClick={() => move(d.id, -1)} className={iconBtn}><ChevronUp size={16} aria-hidden="true" /></button>
                  <button type="button" aria-label={`Move ${d.original_name} later`} disabled={idx === sheet.images.length - 1} onClick={() => move(d.id, 1)} className={iconBtn}><ChevronDown size={16} aria-hidden="true" /></button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      </div>
    </div>
  )
}
