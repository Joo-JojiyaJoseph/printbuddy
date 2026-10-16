import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { pricingKey } from './useQuote'

/**
 * "You could save ₹X" tips. Each idea is priced by the SERVER with the same quote endpoint as the real price, so the
 * saving shown is exact. Ideas: double-sided (when more than one page) and black & white (when printing in colour).
 */
export function useSavings(token, doc, settings, quote, pageCount) {
  const [tips, setTips] = useState([])
  const key = pricingKey(settings)
  const total = quote?.total_paise, sheets = quote?.sheets

  useEffect(() => {
    if (!doc || doc.status !== 'ready' || total == null) { setTips([]); return undefined }
    const ideas = []
    if (!settings.duplex && pageCount > 1) ideas.push({ id: 'duplex', title: 'Print on both sides', patch: { duplex: true } })
    if (settings.color_mode === 'color') ideas.push({ id: 'bw', title: 'Print in black & white', patch: { color_mode: 'bw' } })
    if (!ideas.length) { setTips([]); return undefined }
    let off = false
    // Wait until the settings have stopped changing, so tips never add traffic while the customer is still choosing.
    const t = setTimeout(() => Promise.all(ideas.map((i) => api.quote(token, { document_id: doc.id, settings: { ...settings, ...i.patch } })
      .then((q) => ({ ...i, saving: total - q.total_paise, sheetsSaved: sheets - q.sheets }))
      .catch(() => null)))
      .then((r) => !off && setTips(r.filter((t) => t && t.saving > 0).sort((a, b) => b.saving - a.saving))), 900)
    return () => { off = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doc?.id, doc?.status, key, total, sheets, pageCount])

  return tips
}
