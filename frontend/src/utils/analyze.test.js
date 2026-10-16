import { analyzePixels, summarize } from './analyze'

const px = (...rgba) => new Uint8ClampedArray(rgba.flat())

test('grey text is not colour; a red pixel is', () => {
  const grey = analyzePixels(px([20, 20, 20, 255], [255, 255, 255, 255], [128, 128, 128, 255]))
  expect(grey).toMatchObject({ ink: 2, colour: 0 })
  const red = analyzePixels(px([220, 30, 30, 255], [255, 255, 255, 255]))
  expect(red).toMatchObject({ ink: 1, colour: 1 })
})

test('transparent pixels are ignored', () => {
  expect(analyzePixels(px([200, 0, 0, 0]))).toMatchObject({ ink: 0, colour: 0 })
})

test('summary: black & white landscape document', () => {
  const s = summarize([{ ink: 10, colour: 0, total: 1000, w: 300, h: 200 }, { ink: 5, colour: 0, total: 1000, w: 300, h: 200 }])
  expect(s).toMatchObject({ hasColour: false, mostlyLandscape: true, colourPages: 0 })
})

test('summary: a coloured page is detected; nothing sampled gives null', () => {
  expect(summarize([{ ink: 100, colour: 50, total: 1000, w: 200, h: 300 }])).toMatchObject({ hasColour: true, colourPages: 1, mostlyPortrait: true })
  expect(summarize([null])).toBeNull()
})
