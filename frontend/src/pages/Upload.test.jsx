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

test('offers photo/media and camera-scan upload alongside the file picker', async () => {
  const { render, screen } = await import('@testing-library/react')
  const { default: UploadZone } = await import('../components/UploadZone')
  const got = []
  render(<UploadZone onFiles={(f) => got.push(...f)} />)
  const media = screen.getByLabelText('Choose photos or media from your device')
  const scan = screen.getByLabelText('Scan a document with the camera')
  expect(media.getAttribute('accept')).toContain('image/jpeg')
  expect(scan.getAttribute('capture')).toBe('environment')
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.change(scan, { target: { files: [new File([new Uint8Array([1])], 'scan.jpg', { type: 'image/jpeg' })] } })
  expect(got.map((f) => f.name)).toEqual(['scan.jpg'])
})

test('several uploaded files can be ticked and continued together', async () => {
  const { render: r, screen: sc, fireEvent: fe, waitFor: wf } = await import('@testing-library/react')
  const { MemoryRouter, Routes, Route } = await import('react-router-dom')
  const { default: SessionProvider } = await import('../context/SessionContext')
  const { default: Upload } = await import('./Upload')
  const { mockApi } = await import('../services/mockApi')
  const PNG = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'x.png', { type: 'image/png' })
  const { token } = await mockApi.createSession()
  await mockApi.uploadDocument(token, new File([PNG()], 'one.png'))
  await mockApi.uploadDocument(token, new File([PNG()], 'two.png'))
  r(<MemoryRouter initialEntries={[`/s/${token}/upload`]}><Routes><Route path="/s/:token" element={<SessionProvider />}><Route path="upload" element={<Upload />} /><Route path="edit/:docId" element={<p>edit page</p>} /></Route></Routes></MemoryRouter>)
  await wf(() => expect(sc.getAllByText(/1 page/)).toHaveLength(2), { timeout: 5000 })
  expect(sc.getByRole('button', { name: 'Continue' })).toBeDisabled() // two files, none ticked yet
  const cards = sc.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') !== null)
  fe.click(cards[0]); fe.click(cards[1])
  expect(sc.getByRole('button', { name: 'Continue with 2 files' })).toBeEnabled()
  expect(sc.getByText(/can share sheets/)).toBeInTheDocument()
}, 12000)
