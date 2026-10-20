import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import HelpButton from './HelpGuide'

test('the help button opens a step-by-step guide with screenshots and common questions', () => {
  render(<HelpButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Help: how to print' }))
  expect(screen.getByRole('dialog', { name: 'How to print with Taprint' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Scan the code' })).toBeInTheDocument()
  expect(screen.getByAltText(/Screenshot: Scan the code/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('heading', { name: 'Tap “Get started”' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /I paid but nothing came out/ }))
  expect(screen.getByText(/Do not pay again/)).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
