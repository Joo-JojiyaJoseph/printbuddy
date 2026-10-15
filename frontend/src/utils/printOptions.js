export const PAPER_SIZES = ['A4', 'A5', 'Letter']
export const DEFAULT_SETTINGS = {
  page_range: '', copies: 1, color_mode: 'bw', paper_size: 'A4',
  orientation: 'portrait', duplex: false, scaling: 'fit',
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
    ['Scaling', SCALING[s.scaling] ?? s.scaling],
  ]
}
