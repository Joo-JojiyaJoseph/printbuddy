// JS port of backend PrintPricingService, used ONLY by the mock API so the UI can be developed
// without the Laravel server. Production price always comes from the backend.
export const RULES = {
  rates: [
    { paper_size: 'A4', color_mode: 'bw', per_side_paise: 200 },
    { paper_size: 'A4', color_mode: 'color', per_side_paise: 800 },
    { paper_size: 'A5', color_mode: 'bw', per_side_paise: 150 },
    { paper_size: 'A5', color_mode: 'color', per_side_paise: 600 },
    { paper_size: 'Letter', color_mode: 'bw', per_side_paise: 200 },
    { paper_size: 'Letter', color_mode: 'color', per_side_paise: 800 },
  ],
  duplex_discount_bps: 1000, service_fee_paise: 0, tax_bps: 0,
}
import { parsePageRange } from '../utils/pageRange'

export function quoteFor(pageCount, s, rules = RULES) {
  if (!Number.isInteger(s.copies) || s.copies < 1 || s.copies > 100) throw new Error('Copies must be between 1 and 100.')
  const r = rules.rates.find((x) => x.paper_size === s.paper_size && x.color_mode === s.color_mode)
  if (!r) throw new Error(`No pricing rule for ${s.paper_size}/${s.color_mode}.`)
  const perSheet = s.pages_per_sheet ?? 1
  if (![1, 2, 4, 6, 9].includes(perSheet)) throw new Error('Choose 1, 2, 4, 6 or 9 pages per sheet.')
  const selected = parsePageRange(s.page_range, pageCount).length
  const pages = Math.ceil(selected / perSheet) // N pages share one printed side
  const bps = s.duplex ? rules.duplex_discount_bps : 0
  const eff = r.per_side_paise - Math.floor((r.per_side_paise * bps + 5000) / 10000)
  const sides = pages * s.copies
  const sheets = (s.duplex ? Math.floor((pages + 1) / 2) : pages) * s.copies
  const subtotal = sides * eff
  const fee = rules.service_fee_paise
  const tax = Math.floor(((subtotal + fee) * rules.tax_bps + 5000) / 10000)
  return {
    currency: 'INR', pages_selected: selected, pages_per_sheet: perSheet, sides_per_copy: pages, copies: s.copies, billable_sides: sides, sheets,
    per_side_rate_paise: r.per_side_paise, effective_per_side_rate_paise: eff,
    subtotal_paise: subtotal, service_fee_paise: fee, tax_bps: rules.tax_bps, tax_paise: tax,
    total_paise: subtotal + fee + tax,
  }
}
