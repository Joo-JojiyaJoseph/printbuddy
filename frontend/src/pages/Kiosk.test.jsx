import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test } from 'vitest'
import Kiosk from './Kiosk'
import { mockApi } from '../services/mockApi'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const sessions = () => Object.keys(JSON.parse(localStorage.getItem('pb_mock_sessions') || '{}'))

test('refreshing the printer screen keeps the same code instead of making a new one', async () => {
  const first = render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan')).toBeInTheDocument()
  expect(sessions()).toHaveLength(1)
  first.unmount() // a hard refresh
  render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan')).toBeInTheDocument()
  expect(sessions()).toHaveLength(1) // no second session was created
})

test('refreshing while someone is printing still says the printer is in use and does not offer the code', async () => {
  const first = render(<MemoryRouter><Kiosk /></MemoryRouter>)
  await screen.findByTitle('QR code to scan')
  await mockApi.getSession(sessions()[0], { claim: true }) // a phone scans
  first.unmount()
  render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByText('Someone is using this printer', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(screen.queryByTitle('QR code to scan')).not.toBeInTheDocument()
  expect(sessions()).toHaveLength(1)
}, 12000)

test('an ended or expired code is replaced by a fresh one after a refresh', async () => {
  const first = render(<MemoryRouter><Kiosk /></MemoryRouter>)
  await screen.findByTitle('QR code to scan')
  const old = sessions()[0]
  await mockApi.endSession(old)
  first.unmount()
  render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan')).toBeInTheDocument()
  expect(sessions()).toHaveLength(2)
})

test('if the code cannot be made, the screen says why in plain words and offers a retry', async () => {
  const { ApiError } = await import('../services/errors')
  const orig = mockApi.createSession
  mockApi.createSession = async () => { throw new ApiError(404, 'x') }
  render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByText(/switched off/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Get a new code/ })).toBeInTheDocument()
  mockApi.createSession = orig
})
