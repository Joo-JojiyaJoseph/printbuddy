import { clampRect, markFromTextItem, moveMark, newMark, pictureRect, rectFromDrag, rotateMark } from './marks'
import { fromPageEdits, identityPlan, isIdentity, rotatePage, setMarks, toPageEdits } from './pagePlan'

test('rectangles are kept inside the page', () => {
  expect(clampRect({ x: 0.9, y: -1, w: 0.5, h: 0.2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.2 })
  expect(moveMark(newMark('cover', { x: 0.5, y: 0.5, w: 0.2, h: 0.1 }), 5, 5)).toMatchObject({ x: 0.8, y: 0.9 })
})

test('a tap makes a default-sized box centred on the tap; a drag makes the dragged box', () => {
  const t = rectFromDrag({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 'text')
  expect(t.w).toBeGreaterThan(0.2); expect(t.x + t.w / 2).toBeCloseTo(0.5, 2)
  expect(rectFromDrag({ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.3 }, 'cover')).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
})

test('rotating a page turns its marks with it (clockwise then back)', () => {
  const m = newMark('cover', { x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
  const cw = rotateMark(m, 1)
  expect(cw).toMatchObject({ x: 0.7, y: 0.1, w: 0.1, h: 0.3 })
  const back = rotateMark(cw, -1)
  expect(back).toMatchObject({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 })
})

test('marks make a page count as edited and travel in the edits; page count never changes', () => {
  let plan = identityPlan(2)
  expect(toPageEdits(plan, 2)).toBeNull()
  plan = setMarks(plan, 0, [newMark('hl', { x: 0, y: 0, w: 0.5, h: 0.1 })])
  expect(isIdentity(plan, 2)).toBe(false)
  const e = toPageEdits(plan, 2)
  expect(e.pages).toHaveLength(2); expect(e.pages[0].marks).toHaveLength(1); expect(e.pages[1].marks).toBeUndefined()
  expect(fromPageEdits(e, 2)[0].marks).toHaveLength(1)
  expect(rotatePage(plan, 0, 1)[0].marks[0].t).toBe('hl')
})

test('stamp alone also counts as an edit', () => {
  expect(toPageEdits(identityPlan(1), 1, { numbers: true, watermark: '' })).toMatchObject({ stamp: { numbers: true, watermark: '' } })
  expect(toPageEdits(identityPlan(1), 1, { numbers: false, watermark: '  ' })).toBeNull()
})

test('a clicked PDF word becomes a text mark that covers and re-types it', () => {
  const m = markFromTextItem({ str: 'Hello', left: 100, top: 50, width: 60, height: 12 }, { width: 600, height: 800 })
  expect(m).toMatchObject({ t: 'text', text: 'Hello', cover: true })
  expect(m.x).toBeLessThan(100 / 600); expect(m.x + m.w).toBeGreaterThan(160 / 600)
})

test('where a page lands on the sheet matches the print geometry', () => {
  const a4 = 210 / 297
  const edge = pictureRect('edge', a4, a4)
  expect(edge.left).toBeCloseTo(0, 5); expect(edge.width).toBeCloseTo(1, 5); expect(edge.height).toBeCloseTo(1, 5)
  const fit = pictureRect('fit', a4, a4)
  expect(fit.left).toBeCloseTo(0.04, 3); expect(fit.top).toBeCloseTo(0.04, 3); expect(fit.width).toBeCloseTo(0.92, 3)
  const land = pictureRect('edge', 297 / 210, a4) // portrait page on a landscape sheet: full height, centred
  expect(land.height).toBeCloseTo(1, 5); expect(land.left + land.width / 2).toBeCloseTo(0.5, 5)
  const fill = pictureRect('fill', 297 / 210, a4)  // cover: wider than the sheet, so it is cropped top/bottom
  expect(fill.width).toBeCloseTo(1, 5); expect(fill.height).toBeGreaterThan(1)
  const actual = pictureRect('actual', a4, a4, { paperMm: [210, 297], pageMm: [105, 148.5] })
  expect(actual).toMatchObject({ left: 0.25, top: 0.25, width: 0.5, height: 0.5 })
})
