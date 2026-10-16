import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ImageCustomize from './ImageCustomize'
import SheetPaper from './SheetPaper'
import { DEFAULT_SETTINGS } from '../utils/printOptions'

const imgs = [
  { id: 'a', original_name: 'passport.png', preview_url: 'blob:a', kind: 'png' },
  { id: 'b', original_name: 'photo.jpg', preview_url: 'blob:b', kind: 'jpg' },
  { id: 'c', original_name: 'scan.png', preview_url: 'blob:c', kind: 'png' },
]
const last = (fn) => fn.mock.calls.at(-1)[0]
const setup = (settings = DEFAULT_SETTINGS, props = {}) => {
  const onEdits = vi.fn(), setSettings = vi.fn()
  render(<ImageCustomize doc={imgs[0]} images={imgs} edits={null} onEdits={onEdits} settings={settings} setSettings={setSettings}
    assistant={null} tail={<p>price here</p>} {...props} />)
  return { onEdits, setSettings }
}
// jsdom has no layout: give every cell the size of a 200 x 400 box so drags can be turned into fractions.
beforeEach(() => { Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400 }) })
const cell = () => screen.getAllByRole('button', { name: /^Place passport\.png/ }).at(-1) // the desktop sheet is last in the DOM order of the two it renders

test('one screen: layout, sheet, print options and price together', () => {
  setup()
  expect(screen.getByRole('radiogroup', { name: 'Images per page' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Sides' })).toBeInTheDocument()
  expect(screen.getAllByRole('radiogroup', { name: 'Orientation' })).toHaveLength(1) // asked once, not in two places
  expect(screen.getByText('price here')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /passport\.png/ })).toBeDisabled()
})

test('dragging the picture reports where it was dropped, and an undisturbed picture is no edit', () => {
  const { onEdits } = setup()
  expect(last(onEdits)).toBeNull()
  const c = cell()
  fireEvent.pointerDown(c, { clientX: 100, clientY: 100, pointerId: 1, button: 0 })
  fireEvent.pointerMove(c, { clientX: 150, clientY: 60, pointerId: 1 }) // +50px of a 200px cell, -40px of a 400px cell
  fireEvent.pointerUp(c, { pointerId: 1 })
  const img = last(onEdits).sheet.images[0]
  expect(img.x).toBeCloseTo(0.25, 3)
  expect(img.y).toBeCloseTo(-0.1, 3)
})

test('a drag cannot take the picture further than half a cell from the middle', () => {
  const { onEdits } = setup()
  const c = cell()
  fireEvent.pointerDown(c, { clientX: 0, clientY: 0, pointerId: 1, button: 0 })
  fireEvent.pointerMove(c, { clientX: 5000, clientY: -5000, pointerId: 1 })
  expect(last(onEdits).sheet.images[0]).toMatchObject({ x: 0.5, y: -0.5 })
})

test('moving without pressing does nothing', () => {
  const { onEdits } = setup()
  const before = onEdits.mock.calls.length
  fireEvent.pointerMove(cell(), { clientX: 90, clientY: 90, pointerId: 1 })
  expect(onEdits.mock.calls.length).toBe(before)
})

test('arrow keys nudge the picture (for keyboard users)', () => {
  const { onEdits } = setup()
  fireEvent.keyDown(cell(), { key: 'ArrowRight' })
  expect(last(onEdits).sheet.images[0].x).toBeCloseTo(0.02, 3)
  fireEvent.keyDown(cell(), { key: 'ArrowDown', shiftKey: true })
  expect(last(onEdits).sheet.images[0].y).toBeCloseTo(0.1, 3)
})

test('the size slider resizes the picture and Reset puts it back', () => {
  const { onEdits } = setup()
  fireEvent.change(screen.getAllByLabelText(/^Size/)[0], { target: { value: '50' } })
  expect(last(onEdits).sheet.images[0].zoom).toBe(0.5)
  fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0])
  expect(last(onEdits)).toBeNull() // back to the default layout = no edit at all
})

test('the size cannot go outside 20%-400%', () => {
  const { onEdits } = setup()
  const slider = screen.getAllByLabelText(/^Size/)[0]
  expect(slider).toHaveAttribute('min', '20'); expect(slider).toHaveAttribute('max', '400')
  fireEvent.change(slider, { target: { value: '400' } })
  expect(last(onEdits).sheet.images[0].zoom).toBe(4)
})

test('double-sided: each sheet is placed on its own and the side is named', () => {
  setup({ ...DEFAULT_SETTINGS, duplex: true })
  fireEvent.click(screen.getAllByRole('radio', { name: '1' })[0])
  fireEvent.click(screen.getByRole('checkbox', { name: 'photo.jpg' }))
  expect(screen.getAllByText(/this is the front side/).length).toBeGreaterThan(0)
  expect(screen.getByText(/sheet 1 prints on the front and sheet 2 on the back/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next sheet' }))
  expect(screen.getAllByText(/this is the back side/).length).toBeGreaterThan(0)
  // the picture on the back sheet is the second one
  expect(screen.getAllByRole('button', { name: /^Place photo\.jpg/ }).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: /^Place passport\.png/ })).toBeNull()
})

test('copies of one picture share one position', () => {
  const { onEdits } = setup()
  fireEvent.click(screen.getAllByRole('radio', { name: '4' })[0])
  fireEvent.click(screen.getByRole('radio', { name: 'Copies of each image' }))
  const cells = screen.getAllByRole('button', { name: /^Place passport\.png/ })
  fireEvent.keyDown(cells[0], { key: 'ArrowLeft' })
  expect(last(onEdits).sheet.images).toHaveLength(1)
  expect(last(onEdits).sheet.images[0].x).toBeCloseTo(-0.02, 3)
})

test('the images list and the print options keep working', () => {
  const { onEdits, setSettings } = setup()
  fireEvent.click(screen.getAllByRole('radio', { name: '2' })[0])
  fireEvent.click(screen.getByRole('checkbox', { name: 'photo.jpg' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'scan.png' }))
  expect(screen.getAllByText('3 images → 2 sheets').length).toBeGreaterThan(0)
  expect(last(onEdits).sheet.images.map((i) => i.document_id)).toEqual(['a', 'b', 'c'])
  fireEvent.click(screen.getByRole('radio', { name: 'Colour' }))
  expect(setSettings).toHaveBeenCalled()
  expect(last(setSettings)).not.toHaveProperty('edits')
})

function Sheet({ onPlace }) {
  const [sel, setSel] = useState(null)
  return <SheetPaper cells={[{ document_id: 'a', rot: 0, x: 0.1, zoom: 2 }]} docsById={{ a: imgs[0] }} perPage={1} fit="fit" margin={5} size="A4" orientation="portrait"
    label="s" editable selectedId={sel} onSelect={setSel} onPlace={onPlace} />
}
test('a placed picture is drawn where it was put: moved and scaled inside its own cell', () => {
  render(<Sheet onPlace={() => {}} />)
  const pic = screen.getByRole('button', { name: /^Place passport/ }).querySelector('div')
  expect(pic.style.transform).toBe('translate(10%, 0%) scale(2)')
})

test('a sheet that is only shown (not editable) is not draggable', () => {
  render(<SheetPaper cells={[{ document_id: 'a', rot: 0 }]} docsById={{ a: imgs[0] }} perPage={1} fit="fit" margin={5} size="A4" orientation="portrait" label="s" />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(within(screen.getByRole('img', { name: 's' })).getByAltText('passport.png')).toBeInTheDocument()
})
