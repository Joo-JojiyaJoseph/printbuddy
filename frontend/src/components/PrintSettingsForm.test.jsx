import { render, screen, fireEvent } from '@testing-library/react'
import PrintSettingsForm from './PrintSettingsForm'
import { DEFAULT_SETTINGS } from '../utils/printOptions'

test('stepper, segmented controls and range field emit changes', () => {
  const onChange = vi.fn()
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={onChange} pageCount={6} />)
  fireEvent.click(screen.getByRole('button', { name: 'More copies' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, copies: 2 })
  fireEvent.click(screen.getByRole('radio', { name: 'Double-sided' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, duplex: true })
  fireEvent.change(screen.getByLabelText(/Pages/), { target: { value: '1-3' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, page_range: '1-3' })
})
test('copies cannot go below 1 and range errors are announced', () => {
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} rangeError="Pages must be between 1 and 6." />)
  expect(screen.getByRole('button', { name: 'Fewer copies' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 6')
  expect(screen.getByLabelText(/Pages/)).toHaveAttribute('aria-invalid', 'true')
})
