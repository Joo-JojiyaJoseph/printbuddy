import { pricingKey } from './useQuote'
import { DEFAULT_SETTINGS } from '../utils/printOptions'

const key = (extra) => pricingKey({ ...DEFAULT_SETTINGS, ...extra })
const sheet = (img) => ({ edits: { sheet: { per_page: 2, mode: 'sequence', fit: 'fit', margin: 5, images: [{ document_id: 'a', rot: 0, ...img }] } } })

test('dragging, resizing, turning or positioning does not change the price key (no new quote per mouse move)', () => {
  expect(key(sheet({ x: 0.3, y: -0.2, zoom: 2 }))).toBe(key(sheet({})))
  expect(key({ edits: { pages: [{ src: 1, rot: 90, align: 'tl' }] } })).toBe(key({ edits: { pages: [{ src: 1, rot: 0, align: 'edge' }] } }))
  expect(key({ edits: null })).toBe(key({}))
})

test('every real print option does change it', () => {
  for (const change of [{ copies: 2 }, { duplex: true }, { color_mode: 'color' }, { paper_size: 'A5' }, { page_range: '1-2' }, { pages_per_sheet: 4 }, { orientation: 'landscape' }]) {
    expect(key(change)).not.toBe(key({}))
  }
})
