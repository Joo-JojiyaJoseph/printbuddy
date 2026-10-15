import { quoteFor, RULES } from './mockPricing'

const base = { page_range: '', copies: 1, color_mode: 'bw', paper_size: 'A4', orientation: 'portrait', duplex: false, scaling: 'fit' }
// Same worked examples as backend/tests/run.php, so the mock cannot drift from the PHP service.
test('matches backend examples', () => {
  expect(quoteFor(6, { ...base, copies: 2 }).total_paise).toBe(2400)
  const d = quoteFor(7, { ...base, duplex: true }, { ...RULES, duplex_discount_bps: 0 })
  expect([d.billable_sides, d.sheets, d.total_paise]).toEqual([7, 4, 1400])
  const rules = { ...RULES, duplex_discount_bps: 1000, service_fee_paise: 500, tax_bps: 1800 }
  const q = quoteFor(6, { ...base, copies: 2, duplex: true }, rules)
  expect([q.effective_per_side_rate_paise, q.subtotal_paise, q.tax_paise, q.total_paise]).toEqual([180, 2160, 479, 3139])
  expect(quoteFor(10, { ...base, page_range: '2-4', color_mode: 'color' }).total_paise).toBe(2400)
})
test('rejects bad copies and unknown paper', () => {
  expect(() => quoteFor(1, { ...base, copies: 0 })).toThrow()
  expect(() => quoteFor(1, { ...base, paper_size: 'A3' })).toThrow()
})
