import { describeEdits } from './pagePlan'

export const PAPER_SIZES = ['A4', 'A5', 'Letter']
export const DEFAULT_SETTINGS = {
  page_range: '', copies: 1, color_mode: 'bw', paper_size: 'A4',
  orientation: 'portrait', duplex: false, scaling: 'fit', pages_per_sheet: 1,
}
const SCALING = { fit: 'Fit to page', fill: 'Fill page', actual: 'Actual size' }

export function describeSettings(s) {
  return [
    ['Pages', s.page_range?.trim() || 'All pages'],
    ['Copies', String(s.copies)],
    ['Colour', s.color_mode === 'color' ? 'Colour' : 'Black & white'],
    ['Paper', s.paper_size],
    ['Orientation', s.orientation === 'landscape' ? 'Landscape' : 'Portrait'],
    ['Sides', s.duplex ? 'Double-sided' : 'Single-sided'],
    ...((s.pages_per_sheet ?? 1) > 1 ? [['Layout', `${s.pages_per_sheet} pages per sheet`]] : [['Scaling', SCALING[s.scaling] ?? s.scaling]]), // packed pages are each fitted whole into their own box
    ...describeEdits(s.edits),
  ]
}
