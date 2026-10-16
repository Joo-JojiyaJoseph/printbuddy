import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crop, Move, RotateCcw, RotateCw } from 'lucide-react'
import CropModal from './CropModal'
import SheetPaper from './SheetPaper'
import PreviewDock from './PreviewDock'
import PrintSettingsForm from './PrintSettingsForm'
import Segmented from './ui/Segmented'
import { PER_PAGE_OPTIONS, ZOOM_MAX, ZOOM_MIN, defaultSheet, isPlaced, placeImage, sheetPageCount, sheetPages, toSheetEdits } from '../utils/pagePlan'

const heading = 'mb-1.5 mt-4 block text-sm font-bold'
const iconBtn = 'grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)] disabled:opacity-30'
const sideName = (i) => (i % 2 === 0 ? 'front' : 'back')

/** Size slider and reset for the picture that is selected on the sheet. */
function PlaceBar({ img, name, onPlace, onCrop }) {
  const pct = Math.round((img?.zoom ?? 1) * 100)
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-2.5">
      <p className="m-0 mb-1 flex items-center gap-1.5 text-sm font-bold"><Move size={16} aria-hidden="true" className="flex-none text-accent" /><span className="min-w-0 truncate">{name ?? 'Pick a picture'}</span></p>
      <div className="flex items-center gap-2">
        <label htmlFor="pic-size" className="text-sm font-bold">Size <span className="font-medium text-[var(--muted)]">{pct}%</span></label>
        <input id="pic-size" type="range" min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} step="5" value={pct} disabled={!img} className="h-8 min-w-0 flex-1 accent-[var(--color-accent)]"
          onChange={(e) => onPlace({ zoom: Number(e.target.value) / 100 })} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={!img} onClick={onCrop} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-bold disabled:opacity-40"><Crop size={16} aria-hidden="true" />Crop{img?.crop ? 'ped' : ''}</button>
        <p className="m-0 min-w-0 flex-1 text-xs text-[var(--muted)]">Drag the picture to move it, a corner to resize it.</p>
        <button type="button" disabled={!img || (!img.x && !img.y)} onClick={() => onPlace({ x: 0, y: 0 })} className="min-h-9 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-bold disabled:opacity-40">Centre it</button>
        <button type="button" disabled={!img || !isPlaced(img)} onClick={() => onPlace({ x: 0, y: 0, zoom: 1, crop: null })} className="min-h-9 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-bold disabled:opacity-40">Reset</button>
      </div>
    </div>
  )
}

/**
 * JPG / PNG pictures on ONE screen: several to a sheet, copies of a picture, size and margin, drag-to-place on the sheet,
 * and the print options. Every sheet is edited on its own, so with double-sided printing the front and the back are placed separately.
 */
export default function ImageCustomize({ doc, images, edits, onEdits, settings, setSettings, rangeError, assistant, tail, seedIds = [] }) {
  // Pictures ticked on the upload page start on the same sheet (2 to a page when there is more than one).
  const [sheet, setSheet] = useState(() => {
    if (edits?.sheet) return edits.sheet
    const base = defaultSheet(doc.id)
    const extra = seedIds.filter((id) => id !== doc.id && images.some((d) => d.id === id))
    return extra.length ? { ...base, per_page: 2, images: [...base.images, ...extra.map((document_id) => ({ document_id, rot: 0 }))] } : base
  })
  useEffect(() => { if (!edits?.sheet) onEdits(toSheetEdits(sheet, doc.id)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(0)
  const [selId, setSelId] = useState(doc.id)
  const [cropping, setCropping] = useState(false)
  const byId = useMemo(() => Object.fromEntries(images.map((d) => [d.id, d])), [images])
  const selected = sheet.images.map((i) => i.document_id)
  const pages = sheetPages(sheet)
  const cur = Math.min(page, pages.length - 1)
  const cells = pages[cur] ?? []
  const activeId = cells.some((c) => c.document_id === selId) ? selId : cells[0]?.document_id
  const active = sheet.images.find((i) => i.document_id === activeId)

  const update = (patch) => { const next = { ...sheet, ...patch }; setSheet(next); onEdits(toSheetEdits(next, doc.id)) }
  const place = (id, patch) => update({ images: sheet.images.map((i) => (i.document_id === id ? placeImage(i, patch) : i)) })
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
  const paper = { size: settings.paper_size, orientation: settings.orientation }

  const sheetView = (extra = {}) => (
    <SheetPaper cells={cells} docsById={byId} perPage={sheet.per_page} fit={sheet.fit} margin={sheet.margin}
      size={paper.size} orientation={paper.orientation} grayscale={settings.color_mode === 'bw'} label={`Sheet ${cur + 1} preview`}
      selectedId={activeId} onSelect={setSelId} onPlace={place} {...extra} />
  )
  const placeBar = <PlaceBar img={active} name={byId[activeId]?.original_name} onPlace={(patch) => activeId && place(activeId, patch)} onCrop={() => setCropping(true)} />

  return (
    <div className="mx-auto max-w-3xl md:grid md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:gap-10">
      <PreviewDock title="Sheet preview" interactive mdClass="md:w-[72%] lg:w-[84%] md:max-w-[min(26.25rem,max(14rem,calc((100dvh-24rem)/1.45)))]"
        preview={sheetView({ editable: true })}
        after={<>
          <div className="mt-2 hidden md:block">{placeBar}</div>
          {lonely && <p role="status" className="m-0 mt-2 text-center text-xs text-amber">Only one image is selected. Choose “Copies of each image” to repeat it, or add more images below.</p>}
        </>}>
        <p role="status" className="m-0 mb-1 text-sm font-bold md:mt-1 md:text-center">
          {sheet.images.length} image{sheet.images.length === 1 ? '' : 's'} → {sheetsCount} sheet{sheetsCount === 1 ? '' : 's'}
          {settings.duplex && <span className="font-semibold text-[var(--muted)]"> · this is the {sideName(cur)} side</span>}
        </p>
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--muted)] md:justify-center md:gap-4">
          <button type="button" aria-label="Previous sheet" disabled={cur <= 0} onClick={() => setPage(cur - 1)} className={iconBtn}><ChevronLeft aria-hidden="true" /></button>
          <span>Sheet {cur + 1} of {pages.length}</span>
          <button type="button" aria-label="Next sheet" disabled={cur >= pages.length - 1} onClick={() => setPage(cur + 1)} className={iconBtn}><ChevronRight aria-hidden="true" /></button>
        </div>
      </PreviewDock>

      <div className="min-w-0 max-md:mt-4">
        {/* Phone: the sticky preview is only a thumbnail, so there is a bigger area right here to drag the picture on. */}
        <section aria-label="Place your picture" className="md:hidden">
          <h3 className="m-0 mb-2 text-sm font-bold">Place your picture{settings.duplex ? ` · ${sideName(cur)} side` : ''}</h3>
          <div className="mx-auto w-[78%] max-w-[22rem] py-1">{sheetView({ editable: true })}</div>
          <div className="mt-2">{placeBar}</div>
        </section>
        {settings.duplex && sheetsCount > 1 && <p className="m-0 mt-3 rounded-2xl bg-[var(--hi)] px-3 py-2 text-xs text-[var(--muted)]">Double-sided: sheet 1 prints on the front and sheet 2 on the back, and so on. Use the arrows to move between sheets and place each one on its own.</p>}
        {settings.duplex && sheetsCount === 1 && <p className="m-0 mt-3 rounded-2xl bg-[var(--hi)] px-3 py-2 text-xs text-[var(--muted)]">Double-sided with one sheet: it prints on the front and the back stays blank. Add a second image to use the back.</p>}
        {assistant}

        <span className={`${heading} lg:!mt-0`}>Images per page</span>
        <Segmented label="Images per page" value={sheet.per_page} onChange={(v) => { update({ per_page: v }); setPage(0) }}
          options={PER_PAGE_OPTIONS.map((v) => ({ value: v, label: String(v) }))} />

        <span className={heading}>Layout</span>
        <Segmented label="Layout" value={sheet.mode} onChange={(v) => { update({ mode: v }); setPage(0) }}
          options={[{ value: 'sequence', label: 'Different images' }, { value: 'copies', label: 'Copies of each image' }]} />

        <span className={heading}>Sizing</span>
        <Segmented label="Sizing" value={sheet.fit} onChange={(v) => update({ fit: v })}
          options={[{ value: 'fit', label: 'Fit (whole image)' }, { value: 'fill', label: 'Fill (crop to cell)' }]} />

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
              <li key={d.id} className={`flex items-center gap-2 rounded-2xl border bg-[var(--card)] p-2 ${on && d.id === activeId ? 'border-accent' : 'border-[var(--border)]'}`}>
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

        <div className="mt-4"><PrintSettingsForm value={settings} onChange={({ edits: _e, ...rest }) => setSettings(rest)} rangeError={rangeError} pageCount={sheetsCount} /></div>
        {tail}
      </div>
      {cropping && active && byId[activeId] && (
        <CropModal doc={byId[activeId]} rot={active.rot} crop={active.crop} onClose={() => setCropping(false)}
          onApply={(crop) => { place(activeId, { crop }); setCropping(false) }} />
      )}
    </div>
  )
}
