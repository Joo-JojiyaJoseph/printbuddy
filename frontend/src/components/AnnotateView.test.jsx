import { render, screen, fireEvent } from '@testing-library/react'
import AnnotateView from './AnnotateView'
import { newMark } from '../utils/marks'

const text = newMark('text', { x: 0.1, y: 0.1, w: 0.4, h: 0.05 }, { text: 'Hello' })
const cover = newMark('cover', { x: 0.1, y: 0.3, w: 0.2, h: 0.05 })

function setup(marks = [text, cover]) {
  const calls = []
  render(<AnnotateView pdf={null} src={1} rot={0} marks={marks} onChange={(m, note, opts) => calls.push({ m, note, opts })} />)
  return calls
}

test('offers the editing tools and explains the active one', () => {
  setup()
  for (const n of ['Move', 'Change existing text', 'Add text', 'Erase', 'Highlight']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add text' }))
  expect(screen.getByRole('status')).toHaveTextContent(/where the text should go/i)
})

test('selecting a text mark shows its panel; typing changes it without an undo step per keystroke', () => {
  const calls = setup()
  fireEvent.focus(screen.getByRole('button', { name: 'Text 1' }))
  const box = screen.getByLabelText('Text')
  expect(box).toHaveValue('Hello')
  fireEvent.change(box, { target: { value: 'Hello world' } })
  expect(calls.at(-1).m[0].text).toBe('Hello world')
  expect(calls.at(-1).opts.quiet).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
  expect(calls.at(-1).m[0].bold).toBe(true)
  expect(calls.at(-1).opts.quiet).toBe(false)
})

test('a mark can be deleted from its panel or with the Delete key, and recoloured', () => {
  const calls = setup()
  fireEvent.focus(screen.getByRole('button', { name: 'Erase area 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Colour #000000' }))
  expect(calls.at(-1).m[1].color).toBe('#000000')
  fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
  expect(calls.at(-1).m).toHaveLength(1)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Text 1' }), { key: 'Delete' })
  expect(calls.at(-1).m).toHaveLength(1)
  expect(calls.at(-1).m[0].t).toBe('cover')
})

test('arrow keys nudge a focused mark', () => {
  const calls = setup()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Text 1' }), { key: 'ArrowRight' })
  expect(calls.at(-1).m[0].x).toBeCloseTo(0.11, 3)
})
