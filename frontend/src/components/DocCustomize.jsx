import { ChevronLeft, ChevronRight } from 'lucide-react'
import EditedPreview from './EditedPreview'
import PageStrip from './PageStrip'
import PositionPanel, { positionSummary } from './PositionPanel'
import { MoveDiagonal } from 'lucide-react'
import PreviewDock from './PreviewDock'
import PrintSettingsForm from './PrintSettingsForm'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { useBlankPages } from '../hooks/useBlankPages'
import { usePagePlan } from '../hooks/usePagePlan'
import { isIdentity, paperRatio, previewEdits, removePage, sheetsFor } from '../utils/pagePlan'

/**
 * PDF, Word and text documents on ONE screen: the pages with move / turn / remove under them, the print options and
 * (when printing on both sides) a separate position for the fronts and the backs. `assistant` and `tail` are the
 * suggestions above and the price below, supplied by the page.
 */
export default function DocCustomize({ doc, settings, setSettings, edits, onEdits, rangeError, assistant, tail }) {
  const { pdf, error } = usePdfDocument(doc.preview_url)
  const blank = useBlankPages(pdf, doc.page_count)
  const state = usePagePlan(edits, doc.page_count, onEdits)
  const { plan, cur, setSel } = state
  const perSheet = settings.pages_per_sheet ?? 1
  const sheets = sheetsFor(plan.length, perSheet)
  const sheetNo = Math.floor(cur / perSheet) // 0-based printed sheet on show
  const emptyIdx = plan.findIndex((p) => p.src !== null && blank.has(p.src))
  const goSheet = (s) => setSel(s * perSheet)

  const shown = settings.edits ?? previewEdits(doc, settings.scaling, plan.length)
  const ratio = paperRatio(settings.paper_size, settings.orientation)

  return (
    <div className="mx-auto max-w-3xl md:grid md:max-w-none md:grid-cols-2 md:items-start md:gap-6 lg:gap-10">
      <PreviewDock title={`${doc.original_name} preview`}
        preview={<EditedPreview doc={doc} pdf={pdf} edits={shown} page={sheetNo + 1} settings={settings} images={[]} />}
        after={<>
          <PageStrip pdf={pdf} ratio={ratio} state={state} perSheet={perSheet} />
          {emptyIdx > -1 && (
            <div role="status" className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-amber/40 bg-amber/15 px-3 py-2 text-sm text-amber">
              <span>Page {emptyIdx + 1} looks empty</span>
              <button type="button" onClick={() => state.apply((pl) => removePage(pl, emptyIdx), `Page ${emptyIdx + 1} removed`, emptyIdx)}
                className="min-h-9 rounded-xl bg-amber px-3 font-bold text-white">Remove it</button>
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-center text-sm text-danger">{error}</p>}
        </>}>
        <p className="m-0 mb-1 truncate text-xs font-semibold text-[var(--muted)] md:hidden">
          {settings.paper_size} · {settings.color_mode === 'color' ? 'Colour' : 'Black & white'} · {settings.orientation === 'landscape' ? 'Landscape' : 'Portrait'} · {settings.copies} {settings.copies === 1 ? 'copy' : 'copies'}
        </p>
        {settings.duplex && (
          <p role="status" className="m-0 mb-1 text-xs font-bold text-[var(--muted)] md:text-center">
            Double-sided: sheet {Math.ceil((sheetNo + 1) / 2)} of {Math.ceil(sheets / 2)} · {sheetNo % 2 === 0 ? 'front' : 'back'} side
          </p>
        )}
        {sheets > 1 ? (
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--muted)] md:mb-1 md:justify-center md:gap-4">
            <button type="button" aria-label="Previous page" disabled={sheetNo <= 0} onClick={() => goSheet(sheetNo - 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronLeft aria-hidden="true" /></button>
            <span>{perSheet > 1 ? 'Sheet' : 'Page'} {sheetNo + 1} of {sheets}</span>
            <button type="button" aria-label="Next page" disabled={sheetNo >= sheets - 1} onClick={() => goSheet(sheetNo + 1)} className="grid size-11 place-items-center rounded-2xl border border-[var(--border)] disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
          </div>
        ) : <p className="m-0 text-xs text-[var(--muted)] md:hidden">Tap the preview to enlarge it.</p>}
      </PreviewDock>

      <div className="min-w-0 space-y-3 max-md:mt-4">
        {assistant}
        <PrintSettingsForm value={settings} onChange={({ edits: _e, ...rest }) => setSettings(rest)} rangeError={rangeError} pageCount={plan.length} showLayout
          tail={perSheet === 1 ? [{ id: 'position', icon: MoveDiagonal, title: 'Position on paper', summary: positionSummary(plan, settings.duplex),
            content: <PositionPanel plan={plan} cur={cur} duplex={settings.duplex} apply={state.apply} /> }] : []} />
        {!isIdentity(plan, doc.page_count) && <button type="button" onClick={state.reset} className="min-h-10 text-sm font-bold text-[var(--muted)] underline">Undo all page changes</button>}
        {tail}
      </div>
    </div>
  )
}
