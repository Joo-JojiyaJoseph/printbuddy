import { LIMITS } from './fileValidation'

const A4 = [595.28, 841.89]
const PAGE_MARGIN = 28

/** A photo redrawn upright (phones store them sideways with an "orientation" tag that PDF libraries ignore). */
async function uprightJpeg(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('image')
  return new Uint8Array(await blob.arrayBuffer())
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('A file could not be read back from the server.')
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Joins ready documents (PDFs and pictures) into ONE PDF, in order, inside the browser. The server never needs
 * pdfunite, qpdf or Ghostscript. Pictures become one A4 page each, fitted and centred.
 * @param {{original_name:string, kind:string, preview_url:string}[]} docs
 * @param {{load?: (url:string)=>Promise<Uint8Array>, upright?: (b:Uint8Array)=>Promise<Uint8Array>}} [io] replaceable in tests
 * @returns {Promise<{file: File, pageCount: number}>}
 */
export async function mergeInBrowser(docs, { load = fetchBytes, upright = uprightJpeg } = {}) {
  if (docs.length < 2) throw new Error('Pick at least two files to combine.')
  const { PDFDocument } = await import('pdf-lib')
  const out = await PDFDocument.create()
  for (const d of docs) {
    if (!d.preview_url) throw new Error(`"${d.original_name}" isn't ready yet.`)
    const bytes = await load(d.preview_url)
    if (d.kind === 'pdf') {
      let src
      try { src = await PDFDocument.load(bytes, { ignoreEncryption: false }) } catch { throw new Error(`"${d.original_name}" could not be combined. It may be damaged or protected.`) }
      const pages = await out.copyPages(src, src.getPageIndices())
      pages.forEach((p) => out.addPage(p))
    } else if (d.kind === 'jpg' || d.kind === 'png') {
      let img
      if (d.kind === 'png') img = await out.embedPng(bytes)
      else { try { img = await out.embedJpg(await upright(bytes)) } catch { img = await out.embedJpg(bytes) } }
      const [pw, ph] = img.width > img.height ? [A4[1], A4[0]] : A4 // a wide picture gets a landscape page
      const k = Math.min((pw - 2 * PAGE_MARGIN) / img.width, (ph - 2 * PAGE_MARGIN) / img.height)
      const w = img.width * k
      const h = img.height * k
      out.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    } else {
      throw new Error(`"${d.original_name}" can't be combined.`)
    }
  }
  const pageCount = out.getPageCount()
  const bytes = await out.save()
  if (bytes.byteLength > LIMITS.maxBytes) throw new Error(`The combined file would be over ${LIMITS.maxBytes / 1024 / 1024} MB. Print some of these files separately.`)
  const file = new File([bytes], `Combined (${docs.length} files).pdf`, { type: 'application/pdf' })
  return { file, pageCount }
}
