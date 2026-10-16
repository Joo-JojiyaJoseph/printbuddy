import { useEffect, useState } from 'react'
import { usePdfDocument } from './usePdfDocument'
import { analyzePixels, summarize } from '../utils/analyze'

const MAX_SAMPLES = 6
const SAMPLE_WIDTH = 120

function scan(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return { ...analyzePixels(ctx.getImageData(0, 0, canvas.width, canvas.height).data), w: canvas.width, h: canvas.height }
}

/**
 * Looks at a few pages of the document, on this phone, to tell whether it has colour and which way up it is.
 * Returns { state: 'analyzing' | 'done' | 'unavailable', insights }.
 */
export function useDocInsights(doc) {
  const isImage = doc?.kind === 'jpg' || doc?.kind === 'png'
  const { pdf } = usePdfDocument(!isImage ? doc?.preview_url : null)
  const [res, setRes] = useState({ state: 'analyzing', insights: null })
  const id = doc?.id

  useEffect(() => {
    setRes({ state: 'analyzing', insights: null })
    if (!doc || doc.status !== 'ready') return undefined
    let off = false
    const finish = (pages) => { if (!off) { const insights = summarize(pages); setRes(insights ? { state: 'done', insights } : { state: 'unavailable', insights: null }) } }
    ;(async () => {
      try {
        if (isImage) {
          const img = new Image()
          img.src = doc.preview_url
          await img.decode()
          const c = document.createElement('canvas')
          c.width = SAMPLE_WIDTH; c.height = Math.max(1, Math.round(SAMPLE_WIDTH * img.naturalHeight / img.naturalWidth))
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
          const r = scan(c)
          // For a picture, "wide" is judged on its real shape, not the thumbnail.
          finish([{ ...r, w: img.naturalWidth, h: img.naturalHeight }])
        } else if (pdf) {
          const n = pdf.numPages
          const picks = [...new Set(Array.from({ length: Math.min(MAX_SAMPLES, n) }, (_, i) => Math.round(1 + (i * (n - 1)) / Math.max(1, Math.min(MAX_SAMPLES, n) - 1))))]
          const out = []
          for (const num of picks) {
            if (off) return
            const p = await pdf.getPage(num)
            const base = p.getViewport({ scale: 1 })
            const vp = p.getViewport({ scale: SAMPLE_WIDTH / base.width })
            const c = document.createElement('canvas')
            c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height))
            await p.render({ canvasContext: c.getContext('2d', { willReadFrequently: true }), viewport: vp, canvas: c }).promise
            out.push({ ...scan(c), w: base.width, h: base.height })
            p.cleanup()
          }
          finish(out)
        }
      } catch { if (!off) setRes({ state: 'unavailable', insights: null }) } // analysis is a bonus: never block printing
    })()
    return () => { off = true }
  }, [id, doc?.status, doc?.preview_url, isImage, pdf]) // eslint-disable-line react-hooks/exhaustive-deps

  return res
}
