// Turns a rendered DOM element into a JPEG for the PDF. Everything here needs a real browser (canvas), so it is
// exercised in the browser check rather than in jsdom.
const CSS_PX_TO_PT = 0.75
const MAX_CANVAS_PIXELS = 12_000_000 // phones refuse canvases much beyond ~16M pixels

/** An invisible stage for rendering; removed afterwards. */
export function makeStage(width) {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = `position:fixed;left:-30000px;top:0;width:${width}px;background:#fff;pointer-events:none;`
  document.body.appendChild(el)
  return { el, remove: () => el.remove() }
}

const toJpeg = async (canvas) => {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
  if (!blob) throw new Error('The browser ran out of memory while preparing this page.')
  canvas.width = canvas.height = 0 // hand the memory back at once
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Picture of `el`. With `region` ({y, height} in CSS px) only that horizontal band is drawn, placed `offsetY` px down on
 * a white page that is `pageH` px tall: that is how one long Word section becomes several printed pages.
 */
export async function captureElement(el, { region, pageH, offsetY = 0 } = {}) {
  const { default: html2canvas } = await import('html2canvas')
  if (document.fonts?.ready) await document.fonts.ready
  const w = Math.ceil(el.scrollWidth || el.offsetWidth)
  const h = region ? Math.ceil(region.height) : Math.ceil(el.scrollHeight || el.offsetHeight)
  const outH = region ? Math.ceil(pageH ?? h) : h
  const scale = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (w * outH))))
  const full = Math.ceil(el.scrollHeight || el.offsetHeight)
  const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff', logging: false, useCORS: true, width: w, height: region ? h : full, windowWidth: w, windowHeight: full,
    ...(region ? { y: Math.floor(region.y) } : {}) })
  let out = canvas
  if (region) {
    out = document.createElement('canvas')
    out.width = canvas.width
    out.height = Math.round(outH * scale)
    const g = out.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, out.width, out.height)
    g.drawImage(canvas, 0, Math.round(offsetY * scale))
    canvas.width = canvas.height = 0
  }
  return { jpeg: await toJpeg(out), wPt: w * CSS_PX_TO_PT, hPt: outH * CSS_PX_TO_PT }
}
