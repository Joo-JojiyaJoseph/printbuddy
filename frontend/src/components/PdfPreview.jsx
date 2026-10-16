import { useEffect, useRef, useState } from 'react'
import { usePdfDocument } from '../hooks/usePdfDocument'

export default function PdfPreview({ url, page }) {
  const canvasRef = useRef(null)
  const { pdf, error } = usePdfDocument(url)
  const [renderErr, setErr] = useState(null)
  const err = error ?? renderErr

  useEffect(() => {
    if (!pdf) return
    let off = false, task
    pdf.getPage(page).then((p) => {
      if (off) return
      const el = canvasRef.current
      const width = el.parentElement.clientWidth || 320
      const scale = (width / p.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1)
      const vp = p.getViewport({ scale })
      el.width = vp.width; el.height = vp.height
      el.style.width = '100%'; el.style.height = 'auto'
      task = p.render({ canvasContext: el.getContext('2d'), viewport: vp, canvas: el })
      return task.promise
    }).catch((e) => { if (e?.name !== 'RenderingCancelledException' && !off) setErr('Could not render this page.') })
    return () => { off = true; task?.cancel() }
  }, [pdf, page])

  if (err) return <p role="alert" className="p-6 text-center text-danger">{err}</p>
  return (
    <div className="relative min-h-[12.5rem] w-full overflow-hidden rounded bg-white shadow-[0_10px_30px_rgba(16,36,43,.35)]">
      {!pdf && <div className="absolute inset-0 animate-pulse bg-white/70" role="status" aria-label="Loading preview" />}
      <canvas ref={canvasRef} aria-label={`Page ${page} preview`} />
    </div>
  )
}
