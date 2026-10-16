let loader
/** Lazy-load PDF.js (and its worker) only when a PDF is actually previewed. */
export function loadPdfjs() {
  loader ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(async (m) => {
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  })
  return loader
}
