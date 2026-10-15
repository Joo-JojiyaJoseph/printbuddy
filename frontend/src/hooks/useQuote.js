import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { parsePageRange } from '../utils/pageRange'

/** Debounced server quote. The server's number is the only price ever displayed. */
export function useQuote(token, doc, settings) {
  const [state, setState] = useState({ quote: null, error: null, rangeError: null, loading: false })
  const key = JSON.stringify(settings)
  const id = doc?.id, status = doc?.status, pages = doc?.page_count

  useEffect(() => {
    if (!id || status !== 'ready') return
    try { parsePageRange(settings.page_range, pages) } catch (e) {
      setState({ quote: null, error: null, rangeError: e.message, loading: false })
      return
    }
    let off = false
    setState((s) => ({ ...s, rangeError: null, error: null, loading: true }))
    const t = setTimeout(() => {
      api.quote(token, { document_id: id, settings })
        .then((quote) => !off && setState({ quote, error: null, rangeError: null, loading: false }))
        .catch((e) => !off && setState({ quote: null, error: e.message, rangeError: null, loading: false }))
    }, 300)
    return () => { off = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id, status, pages, key])

  return state
}
