import PageSheet from './PageSheet'
import SheetPaper from './SheetPaper'
import NupSheet from './NupSheet'
import { usePdfDocument } from '../hooks/usePdfDocument'
import { isImageKind, paperMm, paperRatio, sheetPages } from '../utils/pagePlan'

/** Shows output page `page` (1-based) of an edited document or image layout, exactly as edited. */
export default function EditedPreview({ doc, edits, page, settings, images, pdf }) {
  const grayscale = settings.color_mode === 'bw'
  const perSheet = settings.pages_per_sheet ?? 1
  if (edits.sheet) {
    const pages = sheetPages(edits.sheet)
    const byId = Object.fromEntries(images.map((d) => [d.id, d]))
    return <SheetPaper cells={pages[page - 1] ?? []} docsById={byId} perPage={edits.sheet.per_page} fit={edits.sheet.fit} margin={edits.sheet.margin}
      size={settings.paper_size} orientation={settings.orientation} grayscale={grayscale} label={`Sheet ${page} preview`} />
  }
  if (perSheet > 1 && !isImageKind(doc.kind)) return <NupPreview doc={doc} pdf={pdf} edits={edits} page={page} settings={settings} grayscale={grayscale} perSheet={perSheet} />
  return <PagePreview doc={doc} pdf={pdf} edits={edits} page={page} settings={settings} grayscale={grayscale} />
}

/** Sheet `page` with `perSheet` of the (edited) pages on it, in reading order. */
function NupPreview({ doc, pdf: given, edits, page, settings, grayscale, perSheet }) {
  const own = usePdfDocument(given !== undefined ? null : doc.preview_url) // a page that already holds the document passes it in (null while loading): do not download it twice
  const pdf = given !== undefined ? given : own.pdf, error = own.error
  if (error) return <p role="alert" className="p-6 text-center text-danger">{error}</p>
  const items = edits.pages.slice((page - 1) * perSheet, page * perSheet)
  return <NupSheet pdf={pdf} items={items} perSheet={perSheet} ratio={paperRatio(settings.paper_size, settings.orientation)} paperMm={paperMm(settings.paper_size, settings.orientation)}
    orientation={settings.orientation} grayscale={grayscale} stamp={edits.stamp} number={page} total={Math.ceil(edits.pages.length / perSheet)} label={`Sheet ${page} preview, ${perSheet} pages per sheet`} />
}

function PagePreview({ doc, pdf: given, edits, page, settings, grayscale }) {
  const own = usePdfDocument(given !== undefined || isImageKind(doc.kind) ? null : doc.preview_url)
  const pdf = given !== undefined ? given : own.pdf, error = own.error
  if (error) return <p role="alert" className="p-6 text-center text-danger">{error}</p>
  return <PageSheet pdf={pdf} item={edits.pages[page - 1]} ratio={paperRatio(settings.paper_size, settings.orientation)} paperMm={paperMm(settings.paper_size, settings.orientation)} renderWidth={760}
    grayscale={grayscale} number={page} total={edits.pages.length} stamp={edits.stamp} label={`Page ${page} preview`} />
}
