import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { parsePageRange } from '../utils/pageRange'

/**
 * The settings that can change the price. The edits are left out on purpose: they only matter through the number of
 * pages they produce, which the caller passes separately. So dragging a picture, turning a page or choosing where it
 * sits never asks the server for a new quote.
 */
export function pricingKey(settings) {
  const { edits: _edits, ...rest } = settings
  return JSON.stringify(rest)
}

/** Debounced server quote. The server's number is the only price ever displayed. */
export function useQuote(token, doc, settings, pageCount = doc?.page_count) {
  const [state, setState] = useState({ quote: null, error: null, rangeError: null, loading: false })
  const key = pricingKey(settings)
  const id = doc?.id, status = doc?.status, pages = pageCount

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
