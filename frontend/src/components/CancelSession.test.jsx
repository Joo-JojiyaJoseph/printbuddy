import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SessionProvider from '../context/SessionContext'
import Upload from '../pages/Upload'
import Kiosk from '../pages/Kiosk'
import { mockApi } from '../services/mockApi'

test('the customer can end the session after confirming, and the code stops working', async () => {
  const s = await mockApi.createSession()
  render(
    <MemoryRouter initialEntries={[`/s/${s.token}/upload`]}>
      <Routes><Route path="/s/:token" element={<SessionProvider />}><Route path="upload" element={<Upload />} /></Route></Routes>
    </MemoryRouter>
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Leave and delete my files' }))
  expect(screen.getByRole('dialog', { name: /leave and delete my files/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // cancelled: nothing happened
  fireEvent.click(screen.getByRole('button', { name: 'Leave and delete my files' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }))
  expect(await screen.findByRole('heading', { name: 'Session ended' })).toBeInTheDocument()
  await expect(mockApi.getSession(s.token)).rejects.toMatchObject({ status: 410 })
})

test('the kiosk hides the QR code while a phone is connected and can cancel that session', async () => {
  render(<MemoryRouter><Kiosk /></MemoryRouter>)
  expect(await screen.findByTitle('QR code to scan')).toBeInTheDocument()
  const tok = Object.keys(JSON.parse(localStorage.getItem('pb_mock_sessions'))).pop()
  await mockApi.getSession(tok, { claim: true }) // a phone scans
  expect(await screen.findByText('Someone is using this printer', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(screen.queryByTitle('QR code to scan')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Stop and show a new code' }))
  expect(await screen.findByTitle('QR code to scan', {}, { timeout: 3000 })).toBeInTheDocument() // fresh code
}, 12000)
