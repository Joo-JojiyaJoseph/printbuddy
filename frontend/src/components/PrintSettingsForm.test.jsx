import { render, screen, fireEvent } from '@testing-library/react'
import PrintSettingsForm from './PrintSettingsForm'
import { DEFAULT_SETTINGS } from '../utils/printOptions'

test('stepper, segmented controls and range field emit changes', () => {
  const onChange = vi.fn()
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={onChange} pageCount={6} showLayout />)
  fireEvent.click(screen.getByRole('button', { name: 'More copies' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, copies: 2 })
  fireEvent.click(screen.getByRole('radio', { name: 'Double-sided' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, duplex: true })
  fireEvent.click(screen.getByRole('button', { name: /Pages to print/ }))
  fireEvent.change(screen.getByLabelText(/Pages/, { selector: 'input' }), { target: { value: '1-3' } })
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, page_range: '1-3' })
})
test('copies cannot go below 1 and range errors are announced', () => {
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} rangeError="Pages must be between 1 and 6." showLayout />)
  expect(screen.getByRole('button', { name: 'Fewer copies' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 6')
  expect(screen.getByLabelText(/Pages/, { selector: 'input' })).toHaveAttribute('aria-invalid', 'true')
})

const header = (name) => screen.getByRole('button', { name })

test('the everyday options are always on screen; the rest is folded away and says what is chosen', () => {
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} pageCount={6} showLayout />)
  for (const g of ['Colour', 'Sides']) expect(screen.getByRole('radiogroup', { name: g })).toBeVisible()
  expect(screen.getByRole('button', { name: 'More copies' })).toBeVisible()
  // not yet visible: paper, orientation, pages per sheet, range
  for (const g of ['Paper size', 'Orientation', 'Pages per sheet']) expect(screen.queryByRole('radiogroup', { name: g })).toBeNull()
  expect(header(/Paper & orientation/)).toHaveTextContent('A4 · Portrait')
  expect(header(/Pages per sheet/)).toHaveTextContent('One page per sheet')
  expect(header(/Pages to print/)).toHaveTextContent('All pages')
})

test('opening a section shows its options, and only one section is open at a time', () => {
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} pageCount={6} showLayout />)
  fireEvent.click(header(/Paper & orientation/))
  expect(header(/Paper & orientation/)).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('radiogroup', { name: 'Paper size' })).toBeVisible()
  fireEvent.click(header(/Pages per sheet/))
  expect(header(/Paper & orientation/)).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('radiogroup', { name: 'Paper size' })).toBeNull()
  expect(screen.getByRole('radiogroup', { name: 'Pages per sheet' })).toBeVisible()
  fireEvent.click(header(/Pages per sheet/))
  expect(header(/Pages per sheet/)).toHaveAttribute('aria-expanded', 'false')
})

test('changes made inside a section are reported and the summary follows', () => {
  const onChange = vi.fn()
  const { rerender } = render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={onChange} />)
  fireEvent.click(header(/Paper & orientation/))
  fireEvent.click(screen.getByRole('radio', { name: 'Landscape' }))
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, orientation: 'landscape' })
  rerender(<PrintSettingsForm value={{ ...DEFAULT_SETTINGS, orientation: 'landscape', paper_size: 'A5', page_range: '2-4' }} onChange={onChange} />)
  expect(header(/Paper & orientation/)).toHaveTextContent('A5 · Landscape')
  expect(header(/Sheets to print|Pages to print/)).toHaveTextContent('2-4')
})

test('a page range that does not fit opens its section by itself so the message is seen', () => {
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} rangeError="Pages must be between 1 and 6." />)
  expect(screen.getByRole('alert')).toBeVisible()
  expect(header(/Check this/)).toHaveTextContent('between 1 and 6')
})

test('extra sections from the page are listed and can be opened by the "set front & back" link', () => {
  const tail = [{ id: 'position', title: 'Position on paper', summary: 'Fit page', content: <p>position controls</p> }]
  render(<PrintSettingsForm value={{ ...DEFAULT_SETTINGS, duplex: true }} onChange={() => {}} tail={tail} />)
  expect(screen.getByText('position controls')).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Set front & back/ }))
  expect(screen.getByText('position controls')).toBeVisible()
})

test('the front-and-back hint only shows for double-sided printing', () => {
  const tail = [{ id: 'position', title: 'Position on paper', summary: 'Fit page', content: <p>x</p> }]
  render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} tail={tail} />)
  expect(screen.queryByRole('button', { name: /Set front & back/ })).toBeNull()
})
