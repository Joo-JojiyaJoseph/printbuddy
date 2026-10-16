import { useEffect, useState } from 'react'
import { loadPdfjs } from '../utils/pdf'

// PDF.js versions differ on where destroy() lives; never let cleanup crash the page.
const dispose = (d) => { try { (d?.destroy ?? d?.loadingTask?.destroy)?.call(d?.destroy ? d : d.loadingTask) } catch { /* already gone */ } }

/** Loads a PDF once so the editor, thumbnails and preview can all render pages from the same document. */
export function usePdfDocument(url) {
  const [state, setState] = useState({ pdf: null, error: null })
  useEffect(() => {
    if (!url) return undefined
    let off = false, doc
    setState({ pdf: null, error: null })
    // Fetch the bytes ourselves (plain GET) instead of letting PDF.js stream with Range requests: that avoids
    // cross-origin range/preflight problems and lets us report the real reason when it fails.
    const bytes = fetch(url, { credentials: 'omit' }).then((r) => {
      if (!r.ok) throw Object.assign(new Error(`The server answered ${r.status}`), { http: r.status })
      return r.arrayBuffer()
    })
    Promise.all([loadPdfjs(), bytes])
      .then(([m, data]) => m.getDocument({ data: new Uint8Array(data) }).promise)
      .then((d) => { doc = d; if (off) dispose(d); else setState({ pdf: d, error: null }) })
      .catch((e) => {
        console.error('PDF preview failed:', e)
        if (off) return
        const hint = e?.http === 410 || e?.http === 404 ? ' This session may have expired.' : e?.http ? ` (${e.message}).` : ''
        setState({ pdf: null, error: `Could not display this document.${hint}` })
      })
    return () => { off = true; dispose(doc) }
  }, [url])
  return state
}
