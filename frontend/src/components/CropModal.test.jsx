import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CropModal from './CropModal'
import SheetPaper from './SheetPaper'

// jsdom never loads pictures: pretend every picture is 800 x 400
class FakeImage { set src(v) { this.naturalWidth = 800; this.naturalHeight = 400; setTimeout(() => this.onload?.(), 0) } }
beforeEach(() => { vi.stubGlobal('Image', FakeImage) })
afterEach(() => { vi.unstubAllGlobals() })
const rectOf = (w, h) => () => ({ x: 0, y: 0, left: 0, top: 0, right: w, bottom: h, width: w, height: h })

let n = 0
const pic = () => ({ id: 'p', original_name: 'photo.png', preview_url: `blob:crop-${n++}` }) // a new address each time: the size is remembered per address

async function openCrop(props = {}) {
  const onApply = vi.fn(), onClose = vi.fn()
  render(<CropModal doc={pic()} onApply={onApply} onClose={onClose} {...props} />)
  const box = await screen.findByTestId('crop-box')
  box.getBoundingClientRect = rectOf(400, 200)
  return { box, onApply, onClose }
}
const handle = (name) => document.querySelector(`[data-handle="${name}"]`)
const drag = (el, from, to) => { fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1], pointerId: 1, button: 0 }); fireEvent.pointerMove(el, { clientX: to[0], clientY: to[1], pointerId: 1 }); fireEvent.pointerUp(el, { pointerId: 1 }) }
const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))

test('dragging an edge trims that side', async () => {
  const { onApply } = await openCrop()
  drag(handle('w'), [0, 100], [100, 100]) // a quarter of the 400px width
  apply()
  expect(onApply).toHaveBeenCalledWith({ l: 0.25, t: 0, r: 0, b: 0 })
})

test('dragging a corner trims two sides at once', async () => {
  const { onApply } = await openCrop()
  drag(handle('se'), [400, 200], [300, 100]) // 100px in from the right of 400, 100px up of 200
  apply()
  expect(onApply).toHaveBeenCalledWith({ l: 0, t: 0, r: 0.25, b: 0.5 })
})

test('the frame can not squeeze the picture below a tenth, or leave it', async () => {
  const { onApply } = await openCrop()
  drag(handle('e'), [400, 100], [-900, 100])
  apply()
  expect(onApply.mock.calls[0][0]).toEqual({ l: 0, t: 0, r: 0.9, b: 0 })
  drag(handle('w'), [0, 100], [5000, 100]) // the other side cannot cross it either: a tenth is always left
  apply()
  expect(onApply.mock.calls[1][0]).toEqual({ l: 0, t: 0, r: 0.9, b: 0 })
})

test('dragging the frame itself slides it without resizing it', async () => {
  const { onApply } = await openCrop({ crop: { l: 0.1, t: 0.1, r: 0.5, b: 0.5 } })
  drag(screen.getByTestId('crop-frame'), [100, 50], [140, 70]) // +10% across, +10% down
  apply()
  const c = onApply.mock.calls[0][0]
  expect(c.l).toBeCloseTo(0.2, 3); expect(c.r).toBeCloseTo(0.4, 3); expect(c.t).toBeCloseTo(0.2, 3); expect(c.b).toBeCloseTo(0.4, 3)
})

test('"Whole picture" clears the crop', async () => {
  const { onApply } = await openCrop({ crop: { l: 0.2, t: 0, r: 0, b: 0 } })
  fireEvent.click(screen.getByRole('button', { name: 'Whole picture' }))
  apply()
  expect(onApply).toHaveBeenCalledWith(null)
})

test('a turned picture is cropped as it is seen, and stored on the upright picture', async () => {
  const { onApply } = await openCrop({ rot: 90 })
  drag(handle('w'), [0, 100], [100, 100]) // trim the left of what is shown (it has been turned 90 clockwise)
  apply()
  // what is on the left after a clockwise turn is the picture's old bottom
  expect(onApply).toHaveBeenCalledWith({ l: 0, t: 0, r: 0, b: 0.25 })
})

test('an existing crop is shown again when reopened', async () => {
  await openCrop({ crop: { l: 0.2, t: 0, r: 0, b: 0 } })
  expect(screen.getByTestId('crop-frame').style.left).toBe('20%')
})

test('Cancel closes without applying', async () => {
  const { onApply, onClose } = await openCrop()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled()
})

describe('resizing from a corner on the sheet', () => {
  const setup = async (cell = { document_id: 'a', rot: 0 }) => {
    const onPlace = vi.fn()
    render(<SheetPaper cells={[cell]} docsById={{ a: pic() && { id: 'a', original_name: 'a.png', preview_url: `blob:corner-${n++}` } }} perPage={1} fit="fit" margin={0}
      size="A4" orientation="portrait" label="s" editable selectedId="a" onSelect={() => {}} onPlace={onPlace} />)
    await screen.findByTestId('resize-box')
    const cellEl = screen.getByRole('button', { name: /^Place a\.png/ })
    cellEl.getBoundingClientRect = rectOf(200, 400)
    return { onPlace }
  }
  const corner = (name) => document.querySelector(`[data-corner="${name}"]`)

  test('four corner handles appear on the selected picture only', async () => {
    await setup()
    expect(document.querySelectorAll('[data-corner]')).toHaveLength(4)
  })

  test('dragging the bottom-right corner out makes it bigger, keeping the top-left corner in place', async () => {
    const { onPlace } = await setup()
    // 800x400 in a 200x400 cell: 200 x 100, centred. Corner at (100, 50) from the middle; pull it to (300, 150).
    drag(corner('bottom-right'), [200, 250], [400, 350])
    const [id, patch] = onPlace.mock.calls.at(-1)
    expect(id).toBe('a')
    expect(patch.zoom).toBeCloseTo(2, 5)
    expect(patch.x).toBeCloseTo(0.5, 5) // centre moved 100px right of 200
    expect(patch.y).toBeCloseTo(0.125, 5) // and 50px down of 400
  })

  test('dragging a corner in makes it smaller, and the limit is 20%', async () => {
    const { onPlace } = await setup()
    drag(corner('top-left'), [100, 150], [100, 200]) // pulled to the middle
    expect(onPlace.mock.calls.at(-1)[1].zoom).toBeCloseTo(0.5, 5)
    drag(corner('top-left'), [100, 150], [190000, 190000])
    expect(onPlace.mock.calls.at(-1)[1].zoom).toBe(0.2)
  })

  test('using a handle does not also start dragging the picture', async () => {
    const { onPlace } = await setup()
    drag(corner('bottom-right'), [200, 250], [210, 255])
    expect(onPlace.mock.calls.every(([, patch]) => 'zoom' in patch)).toBe(true)
  })

  test('a cropped picture is drawn cropped', async () => {
    await setup({ document_id: 'a', rot: 0, crop: { l: 0.25, t: 0, r: 0.25, b: 0 } })
    const img = screen.getByRole('button', { name: /^Place a\.png/ }).querySelector('img')
    expect(img.style.width).toBe('200%') // the whole picture is twice as wide as what is kept
    expect(img.style.left).toBe('-50%')
  })
})
