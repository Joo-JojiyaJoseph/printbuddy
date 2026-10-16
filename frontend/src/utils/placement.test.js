import { cornerResize, fitBox, shownAspect } from './placement'
import { cropFromDisplayed, cropToDisplayed, normCrop, placeImage, isPlaced, validateEdits, defaultSheet } from './pagePlan'

const near = (a, b) => expect(a).toBeCloseTo(b, 6)

describe('what is shown of a picture', () => {
  it('shape after crop and turn', () => {
    near(shownAspect(800, 400, null), 2)
    near(shownAspect(800, 400, { l: 0.5, t: 0, r: 0, b: 0 }), 1) // half the width gone
    near(shownAspect(800, 400, null, 90), 0.5) // a turned picture swaps its sides
    near(shownAspect(800, 400, { l: 0, t: 0.5, r: 0, b: 0 }, 90), 0.25)
  })
  it('fit shows the whole picture, fill covers the cell', () => {
    expect(fitBox(100, 200, 2, 'fit')).toEqual([100, 50])
    expect(fitBox(100, 200, 2, 'fill')).toEqual([400, 200])
  })
})

describe('dragging a corner', () => {
  const base = { size: [100, 50], center: [0, 0], zoom: 1 }
  it('bottom-right corner out: grows, top-left corner stays put', () => {
    const r = cornerResize({ ...base, corner: [1, 1], pointer: [150, 75] }) // corner moves from (50,25) to (150,75); the fixed corner is (-50,-25)
    near(r.zoom, 2)
    near(r.center[0] - 100, -50) // left edge (centre minus half the new 200 width) is still at -50
    near(r.center[1] - 50, -25) // top edge (centre minus half the new 100 height) is still at -25
  })
  it('top-left corner in: shrinks, bottom-right corner stays put', () => {
    const r = cornerResize({ ...base, corner: [-1, -1], pointer: [0, 0] }) // from (-50,-25) to the middle: half the diagonal
    near(r.zoom, 0.5)
    near(r.center[0] + 25, 50) // right edge: centre + half the new width (25) = 50, the old right edge
    near(r.center[1] + 12.5, 25)
  })
  it('keeps the picture within 20%-400%', () => {
    expect(cornerResize({ ...base, corner: [1, 1], pointer: [5000, 2500] }).zoom).toBe(4)
    expect(cornerResize({ ...base, corner: [1, 1], pointer: [-5000, -2500] }).zoom).toBe(0.2)
  })
  it('a corner that has not moved changes nothing', () => {
    const r = cornerResize({ ...base, corner: [1, -1], pointer: [50, -25] })
    near(r.zoom, 1); near(r.center[0], 0); near(r.center[1], 0)
  })
})

describe('crop values', () => {
  it('are clean, limited, and absent when nothing is trimmed', () => {
    expect(normCrop(null)).toBeNull()
    expect(normCrop({ l: 0, t: 0, r: 0, b: 0 })).toBeNull()
    expect(normCrop({ l: 0.1234567, t: 0, r: 0, b: 0 })).toEqual({ l: 0.1235, t: 0, r: 0, b: 0 })
    expect(normCrop({ l: -1, t: 5, r: 0, b: 0 }).t).toBe(0.9)
  })
  it('never leave less than a tenth on an axis', () => {
    const c = normCrop({ l: 0.6, t: 0, r: 0.6, b: 0 })
    near(c.l + c.r, 0.9)
  })
  it('a crop drawn on the turned picture is stored on the upright one, and back again', () => {
    const shown = { l: 0.1, t: 0.2, r: 0.3, b: 0.4 }
    for (const rot of [0, 90, 180, 270]) expect(cropToDisplayed(cropFromDisplayed(shown, rot), rot)).toEqual(shown)
    // turned 90 clockwise, the picture's old bottom is on the left: trimming the left of what is shown trims the stored bottom
    expect(cropFromDisplayed({ l: 0.5, t: 0, r: 0, b: 0 }, 90)).toEqual({ l: 0, t: 0, r: 0, b: 0.5 })
  })
  it('make a picture "placed" and are kept by placeImage, removed with crop: null', () => {
    const img = { document_id: 'a', rot: 0 }
    const c = placeImage(img, { crop: { l: 0.2, t: 0, r: 0, b: 0 } })
    expect(c.crop).toEqual({ l: 0.2, t: 0, r: 0, b: 0 })
    expect(isPlaced(c)).toBe(true)
    expect(placeImage(c, { x: 0.1 }).crop).toEqual(c.crop) // moving does not lose the crop
    expect(placeImage(c, { crop: null })).toEqual(img)
  })
  it('the demo server refuses bad crops', () => {
    const doc = { id: 'a', kind: 'png' }
    const sheet = (crop) => ({ sheet: { ...defaultSheet('a'), images: [{ document_id: 'a', rot: 0, crop }] } })
    expect(() => validateEdits(sheet({ l: 0.1 }), doc, ['a'])).not.toThrow()
    expect(() => validateEdits(sheet({ l: 0.6, r: 0.6 }), doc, ['a'])).toThrow(/too little/)
    expect(() => validateEdits(sheet('all'), doc, ['a'])).toThrow(/crop/)
    expect(() => validateEdits(sheet({ l: '0.1' }), doc, ['a'])).toThrow(/crop/)
  })
})
