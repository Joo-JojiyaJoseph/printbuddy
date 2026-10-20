import { captureElement, makeStage } from './capture'
import { MAX_CONVERTED_PAGES } from './rasterPdf'

/** PowerPoint (.pptx) → one picture per slide. */
export async function pptxToPages(buffer, { onProgress } = {}) {
  const { init } = await import('pptx-preview')
  const W = 1280
  const stage = makeStage(W)
  try {
    const previewer = init(stage.el, { width: W, height: 720, mode: 'list' })
    await previewer.preview(buffer)
    const slides = [...stage.el.querySelectorAll('.pptx-preview-slide-wrapper')]
    if (!slides.length) throw new Error('No slides were found in this PowerPoint file.')
    if (slides.length > MAX_CONVERTED_PAGES) throw new Error(`This deck has ${slides.length} slides, more than the ${MAX_CONVERTED_PAGES} we can prepare in the browser.`)
    const pages = []
    for (let i = 0; i < slides.length; i++) {
      onProgress?.(i / slides.length)
      slides[i].style.margin = '0'
      pages.push(await captureElement(slides[i]))
    }
    previewer.destroy?.()
    return pages
  } finally { stage.remove() }
}
