import { render, screen, fireEvent } from '@testing-library/react'
import SmartAssistant, { suggestionsFor } from './SmartAssistant'

const mono = { sampled: 3, hasColour: false, colourPages: 0, mostlyLandscape: false, mostlyPortrait: true }

test('suggests black & white for a document with no colour, only while colour is selected', () => {
  expect(suggestionsFor(mono, { color_mode: 'color', orientation: 'portrait' }).map((s) => s.id)).toEqual(['bw'])
  expect(suggestionsFor(mono, { color_mode: 'bw', orientation: 'portrait' })).toEqual([])
})

test('warns when a coloured document is set to black & white; suggests landscape for wide pages', () => {
  const ins = { sampled: 4, hasColour: true, colourPages: 2, mostlyLandscape: true, mostlyPortrait: false }
  expect(suggestionsFor(ins, { color_mode: 'bw', orientation: 'portrait' }).map((s) => s.id)).toEqual(['colour', 'land'])
  expect(suggestionsFor(ins, { color_mode: 'bw', orientation: 'portrait' }, true).map((s) => s.id)).toEqual(['colour']) // pictures: no orientation tip
})

test('one tap applies a suggestion; "Why?" explains it', () => {
  const onApply = vi.fn()
  render(<SmartAssistant state="done" insights={mono} settings={{ color_mode: 'color', orientation: 'portrait' }} onApply={onApply} />)
  fireEvent.click(screen.getByRole('button', { name: 'Why?' }))
  expect(screen.getByRole('dialog')).toHaveTextContent(/not sent to any AI service/i)
  fireEvent.click(screen.getAllByRole('button', { name: 'Apply' }).at(-1))
  expect(onApply).toHaveBeenCalledWith({ color_mode: 'bw' })
})

test('shows progress while analysing, reassurance when nothing to change, nothing when unavailable', () => {
  const { rerender } = render(<SmartAssistant state="analyzing" settings={{}} onApply={() => {}} />)
  expect(screen.getByText(/Looking at your document/)).toBeInTheDocument()
  rerender(<SmartAssistant state="done" insights={mono} settings={{ color_mode: 'bw', orientation: 'portrait' }} onApply={() => {}} />)
  expect(screen.getByText(/settings look good/)).toBeInTheDocument()
  rerender(<SmartAssistant state="unavailable" settings={{}} onApply={() => {}} />)
  expect(screen.queryByRole('region', { name: 'Smart assistant' })).not.toBeInTheDocument()
})
