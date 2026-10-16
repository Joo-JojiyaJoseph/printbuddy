import { render, screen, fireEvent } from '@testing-library/react'
import ImageLayoutEditor from './ImageLayoutEditor'

const imgs = [
  { id: 'a', original_name: 'passport.png', preview_url: 'blob:a', kind: 'png' },
  { id: 'b', original_name: 'photo.jpg', preview_url: 'blob:b', kind: 'jpg' },
  { id: 'c', original_name: 'scan.png', preview_url: 'blob:c', kind: 'png' },
]
const setup = (props = {}) => {
  const onEdits = vi.fn(), onOrientation = vi.fn()
  render(<ImageLayoutEditor doc={imgs[0]} images={imgs} edits={null} onEdits={onEdits} onOrientation={onOrientation}
    paper={{ size: 'A4', orientation: 'portrait' }} {...props} />)
  return { onEdits, onOrientation }
}
const last = (fn) => fn.mock.calls.at(-1)[0]

test('starts as one image on one sheet, with no edits', () => {
  setup()
  expect(screen.getByText('1 image → 1 sheet')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /passport\.png/ })).toBeDisabled() // the image being edited cannot be dropped
})

test('two images to a page packs different images and updates the sheet count', () => {
  const { onEdits } = setup()
  fireEvent.click(screen.getByRole('radio', { name: '2' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'photo.jpg' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'scan.png' }))
  expect(screen.getByText('3 images → 2 sheets')).toBeInTheDocument()
  const sheet = last(onEdits).sheet
  expect(sheet.per_page).toBe(2)
  expect(sheet.images.map((i) => i.document_id)).toEqual(['a', 'b', 'c'])
  expect(screen.getByText('Sheet 1 of 2')).toBeInTheDocument()
})

test('copies mode repeats one image on a single sheet (e.g. 4 passport photos)', () => {
  const { onEdits } = setup()
  fireEvent.click(screen.getByRole('radio', { name: '4' }))
  expect(screen.getByText(/Only one image is selected/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Copies of each image' }))
  expect(screen.getByText('1 image → 1 sheet')).toBeInTheDocument()
  expect(screen.queryByText(/Only one image is selected/)).toBeNull()
  expect(last(onEdits).sheet).toMatchObject({ per_page: 4, mode: 'copies' })
})

test('sizing, margin and rotation are reported', () => {
  const { onEdits } = setup()
  fireEvent.click(screen.getByRole('radio', { name: /Fill/ }))
  expect(last(onEdits).sheet.fit).toBe('fill')
  fireEvent.change(screen.getByLabelText(/Margin/), { target: { value: '12' } })
  expect(last(onEdits).sheet.margin).toBe(12)
  fireEvent.click(screen.getByRole('button', { name: 'Rotate passport.png right' }))
  expect(last(onEdits).sheet.images[0].rot).toBe(90)
})

test('orientation is changed through the parent, and putting everything back means no edits', () => {
  const { onEdits, onOrientation } = setup()
  fireEvent.click(screen.getByRole('radio', { name: 'Landscape' }))
  expect(onOrientation).toHaveBeenCalledWith('landscape')
  fireEvent.click(screen.getByRole('radio', { name: '2' }))
  fireEvent.click(screen.getByRole('radio', { name: '1' }))
  expect(last(onEdits)).toBeNull()
})

test('images can be reordered', () => {
  const { onEdits } = setup({ edits: { sheet: { per_page: 2, mode: 'sequence', fit: 'fit', margin: 5, images: [{ document_id: 'a', rot: 0 }, { document_id: 'b', rot: 0 }] } } })
  fireEvent.click(screen.getByRole('button', { name: 'Move photo.jpg earlier' }))
  expect(last(onEdits).sheet.images.map((i) => i.document_id)).toEqual(['b', 'a'])
})
