import { pagesToPdf } from './rasterPdf'
import { conversionBlocker, extOf } from './detect'

const READERS = {
  docx: () => import('./docx').then((m) => m.docxToPages),
  pptx: () => import('./pptx').then((m) => m.pptxToPages),
  xlsx: () => import('./xlsx').then((m) => m.xlsxToPages),
}
/**
 * Word / Excel / PowerPoint → a PDF File, made entirely in the customer's browser (nothing to install on the server).
 * The layout is close to the original, not identical to what Office itself would print.
 */
export async function convertToPdf(file, { onProgress } = {}) {
  const ext = extOf(file.name)
  const read = READERS[ext]
  if (!read) throw new Error(conversionBlocker(file, 'ooxml') ?? 'This file type cannot be prepared.')
  const toPages = await read()
  let pages
  try {
    pages = await toPages(await file.arrayBuffer(), { onProgress: (f) => onProgress?.(f * 0.9) })
  } catch (e) {
    if (/^(This |No |The sheet)/.test(e.message)) throw e
    throw new Error(`"${file.name}" couldn't be prepared in your browser. Save it as a PDF from ${ext === 'docx' ? 'Word' : ext === 'xlsx' ? 'Excel' : 'PowerPoint'} and upload that instead.`)
  }
  const bytes = await pagesToPdf(pages)
  onProgress?.(1)
  return new File([bytes], file.name.replace(/\.[^.]+$/, '') + '.pdf', { type: 'application/pdf' })
}
