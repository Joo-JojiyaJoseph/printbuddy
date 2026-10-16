import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import DocCustomize from './DocCustomize'
import { DEFAULT_SETTINGS } from '../utils/printOptions'

vi.mock('../hooks/usePdfDocument', () => ({ usePdfDocument: () => ({ pdf: null, error: null }) }))
let blankPages = new Set()
vi.mock('../hooks/useBlankPages', () => ({ useBlankPages: () => blankPages }))
beforeEach(() => { blankPages = new Set() })

const doc = { id: 'd1', original_name: 'notes.pdf', kind: 'pdf', page_count: 4, preview_url: 'blob:x', can_edit_text: true }
// The page owns the edits; this mirrors that so the preview and the position panel follow what the customer does.
function Harness({ settings = DEFAULT_SETTINGS, onEdits }) {
  const [edits, setEdits] = useState(null)
  return <DocCustomize doc={doc} settings={{ ...settings, edits }} setSettings={() => {}} edits={edits}
    onEdits={(e) => { setEdits(e); onEdits(e) }} assistant={null} tail={<p>price here</p>} />
}
const setup = (settings) => { const onEdits = vi.fn(); render(<Harness settings={settings} onEdits={onEdits} />); return onEdits }
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const last = (fn) => fn.mock.calls.at(-1)[0]

test('one screen: pages, print options, position and price together', () => {
  setup()
  expect(screen.getByRole('listbox', { name: 'Pages' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: /Pages/ })).toBeInTheDocument() // page range, from the print options
  expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Position on paper' })).toBeInTheDocument()
  expect(screen.getByText('price here')).toBeInTheDocument()
})

test('the old editing tools are gone', () => {
  setup()
  for (const name of [/Edit on page/, /Edit text/, /Copy page/, /Add blank/, /Done editing/]) expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.queryByText(/Page numbers/)).toBeNull()
  expect(screen.queryByText(/Watermark/)).toBeNull()
})

test('move and remove sit right under the page thumbnails', () => {
  setup()
  const strip = screen.getByRole('region', { name: 'Your pages' })
  const list = within(strip).getByRole('listbox', { name: 'Pages' })
  const actions = within(strip).getByRole('group', { name: /actions/ })
  expect(list.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  for (const n of [/Move earlier/, /Move later/, /Remove/]) expect(within(actions).getByRole('button', { name: n })).toBeInTheDocument()
})

test('remove, move and Undo change the plan and are reported to the page', () => {
  const onEdits = setup()
  expect(screen.getByText('Page 1 of 4')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Page 2' }))
  click(/Remove/)
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([1, 3, 4])
  expect(screen.getByText('Page 2 removed')).toBeInTheDocument()
  click('Undo')
  expect(last(onEdits)).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: 'Page 1' }))
  expect(screen.getByRole('button', { name: /Move earlier/ })).toBeDisabled()
  click(/Move later/)
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([2, 1, 3, 4])
  click(/Turn right/)
  expect(last(onEdits).pages[1].rot).toBe(90)
})

test('single-sided: position applies to all pages, or to just one', () => {
  const onEdits = setup()
  fireEvent.click(within(screen.getByRole('region', { name: 'Position on paper' })).getByRole('radio', { name: /Top-left/ }))
  expect(last(onEdits).pages.every((p) => p.align === 'tl')).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: 'Page 1 only' }))
  fireEvent.click(screen.getByRole('radio', { name: /Centre/ }))
  expect(last(onEdits).pages.map((p) => p.align)).toEqual(['center', 'tl', 'tl', 'tl'])
})

test('double-sided: front sides and back sides are positioned separately', () => {
  const onEdits = setup({ ...DEFAULT_SETTINGS, duplex: true })
  const panel = screen.getByRole('region', { name: 'Position on paper' })
  expect(within(panel).getByRole('radio', { name: 'Front sides' })).toBeChecked()
  expect(within(panel).getByRole('radio', { name: 'Back sides' })).toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('radio', { name: /Fill page/ })) // fronts: pages 1 and 3
  expect(last(onEdits).pages.map((p) => p.align)).toEqual(['fill', 'edge', 'fill', 'edge'])
  fireEvent.click(within(panel).getByRole('radio', { name: 'Back sides' }))
  expect(within(panel).getByRole('radio', { name: /Fit page/ })).toBeChecked() // the backs still have their own value
  fireEvent.click(within(panel).getByRole('radio', { name: /Top-left/ }))
  expect(last(onEdits).pages.map((p) => p.align)).toEqual(['fill', 'tl', 'fill', 'tl'])
})

test('double-sided preview says which side is on show', () => {
  setup({ ...DEFAULT_SETTINGS, duplex: true })
  expect(screen.getByText(/sheet 1 of 2 · front side/)).toBeInTheDocument()
  click('Next page')
  expect(screen.getByText(/sheet 1 of 2 · back side/)).toBeInTheDocument()
})

test('an empty page is offered for removal', () => {
  blankPages = new Set([3])
  const onEdits = setup()
  expect(screen.getByText('Page 3 looks empty')).toBeInTheDocument()
  click('Remove it')
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([1, 2, 4])
})

test('several pages per sheet: no per-page position (each page is fitted into its own box)', () => {
  setup({ ...DEFAULT_SETTINGS, pages_per_sheet: 2 })
  expect(screen.queryByRole('region', { name: 'Position on paper' })).toBeNull()
})
