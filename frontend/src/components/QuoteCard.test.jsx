import { render, screen } from '@testing-library/react'
import QuoteCard from './QuoteCard'

const quote = { pages_selected: 6, copies: 2, billable_sides: 12, sheets: 6, effective_per_side_rate_paise: 180,
  subtotal_paise: 2160, service_fee_paise: 500, tax_paise: 479, total_paise: 3139 }

test('shows the server-provided breakdown, never its own maths', () => {
  render(<QuoteCard quote={quote} />)
  expect(screen.getByText('₹31.39')).toBeInTheDocument()
  expect(screen.getByText('₹21.60')).toBeInTheDocument()
  expect(screen.getByText('Service fee')).toBeInTheDocument()
  expect(screen.getByText('6 pages × 2 copies')).toBeInTheDocument()
})
test('loading and error states', () => {
  const { rerender } = render(<QuoteCard loading />)
  expect(screen.getByRole('status', { name: 'Calculating price' })).toBeInTheDocument()
  rerender(<QuoteCard error="No pricing rule for A3/bw." />)
  expect(screen.getByRole('alert')).toHaveTextContent('No pricing rule')
})
