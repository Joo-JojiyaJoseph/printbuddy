import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from './App'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

test('the short kiosk link /k/<code> shows the QR code', async () => {
  render(<MemoryRouter initialEntries={['/k/demo']}><App /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan', {}, { timeout: 8000 })).toBeInTheDocument()
})

test('the older /kiosk?k= link still works', async () => {
  render(<MemoryRouter initialEntries={['/kiosk?k=demo']}><App /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan', {}, { timeout: 8000 })).toBeInTheDocument()
})

test('an edited or unknown address inside a session does not show an error page', async () => {
  render(<MemoryRouter initialEntries={['/s/not-a-real-token/whatever/else']}><App /></MemoryRouter>)
  // it lands on the friendly "scan the code again" message, never a blank or a crash
  expect(await screen.findByText(/scan the code on the printer screen again/i, {}, { timeout: 8000 })).toBeInTheDocument()
})
