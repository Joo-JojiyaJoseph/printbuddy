import { useEffect, useState } from 'react'

const MAX_PAGES_SCANNED = 40

/** Finds source pages with no visible ink (cheap low-res render), so the editor can offer to remove them. */
export function useBlankPages(pdf, pageCount) {
  const [blank, setBlank] = useState(() => new Set())
  useEffect(() => {
    if (!pdf || !pageCount || pageCount > MAX_PAGES_SCANNED) return undefined
    let off = false
    ;(async () => {
      const found = new Set()
      for (let i = 1; i <= pageCount && !off; i++) {
        try {
          const p = await pdf.getPage(i)
          const vp = p.getViewport({ scale: 60 / p.getViewport({ scale: 1 }).width })
          const c = document.createElement('canvas')
          c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height))
          const ctx = c.getContext('2d', { willReadFrequently: true })
          await p.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise
          const d = ctx.getImageData(0, 0, c.width, c.height).data
          let ink = 0
          for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0 && (d[k] < 235 || d[k + 1] < 235 || d[k + 2] < 235)) ink++
          if (ink <= 3) found.add(i)
          p.cleanup()
        } catch { /* a page we cannot scan is simply not flagged */ }
      }
      if (!off) setBlank(found)
    })()
    return () => { off = true }
  }, [pdf, pageCount])
  return blank
}
