import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

test('opens as a dialog, closes with Escape and with the close button', () => {
  const onClose = vi.fn()
  const { rerender } = render(<Modal open title="Hello" onClose={onClose}><p>Body</p></Modal>)
  expect(screen.getByRole('dialog', { name: 'Hello' })).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(2)
  rerender(<Modal open={false} title="Hello" onClose={onClose}><p>Body</p></Modal>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
