import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SessionProvider from '../context/SessionContext'
import Upload from './Upload'
import { mockApi } from '../services/mockApi'

async function setup() {
  const s = await mockApi.createSession()
  render(
    <MemoryRouter initialEntries={[`/s/${s.token}/upload`]}>
      <Routes><Route path="/s/:token" element={<SessionProvider />}><Route path="upload" element={<Upload />} /></Route></Routes>
    </MemoryRouter>
  )
  await screen.findByRole('heading', { name: /where is your file/i })
  return screen.getByLabelText('Choose files to upload')
}
const choose = (input, bytes, name) => fireEvent.change(input, { target: { files: [new File([new Uint8Array(bytes)], name)] } })

test('rejects a disguised executable with a clear message and keeps Continue disabled', async () => {
  const input = await setup()
  choose(input, [0x4d, 0x5a, 0x90, 0], 'invoice.pdf')
  expect(await screen.findByRole('alert')).toHaveTextContent(/valid PDF/)
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
})

test('accepts a real PNG, shows it ready, and enables Continue', async () => {
  const input = await setup()
  choose(input, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0], 'photo.png')
  expect(await screen.findByText(/1 page/, {}, { timeout: 4000 })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo.png' }))
  await waitFor(() => expect(screen.queryByText('photo.png')).not.toBeInTheDocument())
})

test('expired or unknown sessions show an error instead of the app', async () => {
  render(
    <MemoryRouter initialEntries={['/s/deadbeef/upload']}>
      <Routes><Route path="/s/:token" element={<SessionProvider />}><Route path="upload" element={<Upload />} /></Route></Routes>
    </MemoryRouter>
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't find this session/i)
})
