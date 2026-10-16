import { render, screen, fireEvent, within } from '@testing-library/react'
import PageEditor from './PageEditor'

vi.mock('../hooks/usePdfDocument', () => ({ usePdfDocument: () => ({ pdf: null, error: null }) }))
let blankPages = new Set()
vi.mock('../hooks/useBlankPages', () => ({ useBlankPages: () => blankPages }))
beforeEach(() => { blankPages = new Set() })

const doc = { id: 'd1', page_count: 4, preview_url: 'blob:x', can_edit_text: true }
const setup = (props = {}) => {
  const onEdits = vi.fn()
  render(<PageEditor doc={doc} edits={null} onEdits={onEdits} ratio={210 / 297} onEditText={() => {}} {...props} />)
  return onEdits
}
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const last = (fn) => fn.mock.calls.at(-1)[0]

test('starts unedited and shows the page count', () => {
  setup()
  expect(screen.getByText('Page 1 of 4')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  expect(screen.getAllByRole('option')).toHaveLength(4)
})

test('remove drops the page, reports edits, and Undo restores the original (no edits)', () => {
  const onEdits = setup()
  fireEvent.click(screen.getByRole('option', { name: 'Page 2' }))
  click(/Remove$/)
  expect(screen.getAllByRole('option')).toHaveLength(3)
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([1, 3, 4])
  expect(screen.getByText('Page 2 removed')).toBeInTheDocument()
  click('Undo')
  expect(screen.getAllByRole('option')).toHaveLength(4)
  expect(last(onEdits)).toBeNull()
  click('Redo')
  expect(last(onEdits).pages).toHaveLength(3)
})

test('rotate, copy, add blank and move change the plan', () => {
  const onEdits = setup()
  click(/Rotate right/)
  expect(last(onEdits).pages[0].rot).toBe(90)
  click(/Copy page/)
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([1, 1, 2, 3, 4])
  click(/Add blank$/)
  expect(last(onEdits).pages.some((p) => p.src === null)).toBe(true)
  expect(screen.getByText(/Blank pages you add are printed and charged/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('option', { name: 'Page 1' }))
  expect(screen.getByRole('button', { name: /Move earlier/ })).toBeDisabled()
  click(/Move later/)
  expect(last(onEdits).pages.slice(0, 2).map((p) => p.src)).toEqual([1, 1])
})

test('position on paper applies to the page or to all pages', () => {
  const onEdits = setup()
  fireEvent.click(screen.getByRole('radio', { name: 'Top-left' }))
  expect(last(onEdits).pages.map((p) => p.align)).toEqual(['tl', 'fit', 'fit', 'fit'])
  click('Apply to all pages')
  expect(last(onEdits).pages.every((p) => p.align === 'tl')).toBe(true)
})

test('offers to remove a page that looks empty', () => {
  blankPages = new Set([2])
  const onEdits = setup()
  const hint = screen.getByText('Page 2 looks empty').closest('[role="status"]')
  fireEvent.click(within(hint).getByRole('button', { name: 'Remove' }))
  expect(last(onEdits).pages.map((p) => p.src)).toEqual([1, 3, 4])
})

test('the last page cannot be removed, reset clears all edits', () => {
  const onEdits = setup({ doc: { ...doc, page_count: 1 } })
  expect(screen.getByRole('button', { name: /Remove$/ })).toBeDisabled()
  click(/Rotate left/)
  click('Reset edits')
  expect(last(onEdits)).toBeNull()
})

test('Edit text appears only for documents whose text can be edited', () => {
  const onEditText = vi.fn()
  const { unmount } = render(<PageEditor doc={doc} edits={null} onEdits={() => {}} ratio={0.7} onEditText={onEditText} />)
  fireEvent.click(screen.getByRole('button', { name: /Edit text/ }))
  expect(onEditText).toHaveBeenCalled()
  unmount()
  render(<PageEditor doc={{ ...doc, can_edit_text: false }} edits={null} onEdits={() => {}} ratio={0.7} onEditText={onEditText} />)
  expect(screen.queryByRole('button', { name: /Edit text/ })).toBeNull()
})

test('resumes from saved edits', () => {
  const edits = { pages: [{ src: 3, rot: 0, align: 'fit' }, { src: 1, rot: 90, align: 'center' }] }
  setup({ edits })
  expect(screen.getByText(/Page 1 of 2 · original page 3/)).toBeInTheDocument()
})
