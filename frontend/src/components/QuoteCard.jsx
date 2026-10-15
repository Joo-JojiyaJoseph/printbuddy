import Card from './ui/Card'
import { formatINR } from '../utils/format'
import { IS_MOCK } from '../services/api'

const Row = ({ k, v, total }) => (
  <div className={`flex justify-between border-b border-dashed border-[var(--border)] py-2 ${total ? 'border-0 text-xl font-black' : 'text-[15px]'}`}><span>{k}</span><span>{v}</span></div>
)

export default function QuoteCard({ quote, loading, error }) {
  return (
    <Card aria-busy={loading} aria-live="polite">
      <h3 className="m-0 mb-1 text-sm font-bold">Price</h3>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!quote && !error && <div className="h-24 animate-pulse rounded-2xl bg-[var(--hi)]" role="status" aria-label="Calculating price" />}
      {quote && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <Row k={`${quote.pages_selected} pages × ${quote.copies} ${quote.copies === 1 ? 'copy' : 'copies'}`} v={`${quote.billable_sides} sides`} />
          <Row k="Rate per side" v={formatINR(quote.effective_per_side_rate_paise)} />
          <Row k="Subtotal" v={formatINR(quote.subtotal_paise)} />
          {quote.service_fee_paise > 0 && <Row k="Service fee" v={formatINR(quote.service_fee_paise)} />}
          {quote.tax_paise > 0 && <Row k="Tax" v={formatINR(quote.tax_paise)} />}
          <Row total k="Total" v={formatINR(quote.total_paise)} />
          <p className="m-0 mt-1 text-xs text-[var(--muted)]">{quote.sheets} {quote.sheets === 1 ? 'sheet' : 'sheets'} of paper</p>
        </div>
      )}
      {IS_MOCK && <p className="m-0 mt-2 text-xs text-amber">Demo pricing from the mock API. The Laravel server calculates real prices.</p>}
    </Card>
  )
}
