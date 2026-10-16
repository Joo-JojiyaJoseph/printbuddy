import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PerSheetPicker from './PerSheetPicker'
import NupSheet from './NupSheet'
import PrintSettingsForm from './PrintSettingsForm'
import { DEFAULT_SETTINGS, describeSettings } from '../utils/printOptions'
import { suggestionsFor } from './SmartAssistant'
import { gridFor, sheetsFor, PAGES_PER_SHEET } from '../utils/pagePlan'
import { quoteFor, RULES } from '../services/mockPricing'

describe('pages per sheet', () => {
  it('offers 1, 2, 4, 6 and 9 and reports the choice', () => {
    const onChange = vi.fn()
    render(<PerSheetPicker value={1} onChange={onChange} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('radio', { name: '1 page per sheet' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: '4 pages per sheet' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })
  it('grids: 2 stack on portrait and sit side by side on landscape; 9 is 3x3', () => {
    expect(gridFor(2, false)).toEqual([1, 2]); expect(gridFor(2, true)).toEqual([2, 1]); expect(gridFor(9, false)).toEqual([3, 3])
    expect(PAGES_PER_SHEET).toEqual([1, 2, 4, 6, 9]); expect(sheetsFor(10, 4)).toBe(3); expect(sheetsFor(10)).toBe(10)
  })
  it('the sheet preview has one cell per slot', () => {
    render(<NupSheet pdf={null} items={[{ src: 1, rot: 0 }, { src: 2, rot: 0 }]} perSheet={6} ratio={210 / 297} paperMm={[210, 297]} orientation="portrait" label="Sheet 1 preview" number={1} total={1} />)
    expect(screen.getByRole('img', { name: 'Sheet 1 preview' })).toHaveAttribute('data-cells', '6')
  })
  it('the settings form shows the picker only for documents, and hides Scaling once pages are packed', () => {
    const { rerender } = render(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} pageCount={8} showLayout />)
    expect(screen.getByRole('radiogroup', { name: 'Pages per sheet' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Scaling' })).toBeInTheDocument()
    rerender(<PrintSettingsForm value={{ ...DEFAULT_SETTINGS, pages_per_sheet: 2 }} onChange={() => {}} pageCount={8} showLayout />)
    expect(screen.queryByRole('radiogroup', { name: 'Scaling' })).toBeNull()
    rerender(<PrintSettingsForm value={DEFAULT_SETTINGS} onChange={() => {}} pageCount={1} />)
    expect(screen.queryByRole('radiogroup', { name: 'Pages per sheet' })).toBeNull()
  })
  it('the order summary names the layout only when it is not 1 per sheet', () => {
    expect(describeSettings(DEFAULT_SETTINGS).some(([k]) => k === 'Layout')).toBe(false)
    expect(describeSettings({ ...DEFAULT_SETTINGS, pages_per_sheet: 4 })).toContainEqual(['Layout', '4 pages per sheet'])
    expect(describeSettings({ ...DEFAULT_SETTINGS, pages_per_sheet: 4 }).some(([k]) => k === 'Scaling')).toBe(false)
    expect(describeSettings(DEFAULT_SETTINGS).some(([k]) => k === 'Scaling')).toBe(true)
  })
  it('bills printed sides: 10 slides at 2 per sheet cost 5 sides', () => {
    const q = quoteFor(10, { ...DEFAULT_SETTINGS, pages_per_sheet: 2 }, RULES)
    expect(q.billable_sides).toBe(5); expect(q.pages_selected).toBe(10); expect(q.pages_per_sheet).toBe(2)
    expect(quoteFor(10, DEFAULT_SETTINGS, RULES).billable_sides).toBe(10)
    expect(() => quoteFor(10, { ...DEFAULT_SETTINGS, pages_per_sheet: 3 }, RULES)).toThrow()
  })
  it('suggests 2 per sheet for slides, not for portrait pages or when already packed', () => {
    const slides = { mostlyLandscape: true, hasColour: false }
    expect(suggestionsFor(slides, { ...DEFAULT_SETTINGS, orientation: 'landscape' }, false, 12).find((s) => s.id === 'nup')?.patch).toEqual({ pages_per_sheet: 2, orientation: 'portrait' })
    expect(suggestionsFor(slides, DEFAULT_SETTINGS, false, 2).some((s) => s.id === 'nup')).toBe(false)
    expect(suggestionsFor({ mostlyPortrait: true }, DEFAULT_SETTINGS, false, 12).some((s) => s.id === 'nup')).toBe(false)
    expect(suggestionsFor(slides, { ...DEFAULT_SETTINGS, pages_per_sheet: 4 }, false, 12).some((s) => s.id === 'nup')).toBe(false)
    expect(suggestionsFor(slides, DEFAULT_SETTINGS, true, 12).some((s) => s.id === 'nup')).toBe(false)
  })
})
