import { useEffect, useRef } from 'react'
import { useInView } from '../hooks/useInView'

/** Draws one PDF page (optionally rotated by a further 0/90/180/270) into a canvas; lazy when `lazy` is set. */
export default function PdfCanvas({ pdf, page, rotation = 0, width = 400, lazy = false, className = '', label }) {
  const canvasRef = useRef(null)
  const [wrapRef, seen] = useInView()
  const visible = !lazy || seen

  useEffect(() => {
    if (!pdf || !page || !visible) return undefined
    let off = false, task
    ;(async () => {
      const p = await pdf.getPage(page)
      if (off) return
      const rot = (p.rotate + rotation) % 360
      const base = p.getViewport({ scale: 1, rotation: rot })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = p.getViewport({ scale: (width / base.width) * dpr, rotation: rot })
      const el = canvasRef.current
      if (!el) return
      el.width = Math.floor(vp.width); el.height = Math.floor(vp.height)
      task = p.render({ canvasContext: el.getContext('2d'), viewport: vp, canvas: el })
      await task.promise
    })().catch(() => { /* cancelled renders and unreadable pages just stay blank */ })
    return () => { off = true; task?.cancel() }
  }, [pdf, page, rotation, width, visible])

  return (
    <span ref={wrapRef} className="block h-full w-full">
      <canvas ref={canvasRef} aria-label={label} className={className} />
    </span>
  )
}
