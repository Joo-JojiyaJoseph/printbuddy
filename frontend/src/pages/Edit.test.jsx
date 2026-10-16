import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import SessionProvider from '../context/SessionContext'
import Edit from './Edit'
import { mockApi } from '../services/mockApi'

vi.mock('../hooks/usePdfDocument', () => ({ usePdfDocument: () => ({ pdf: null, error: null }) }))
vi.mock('../hooks/useBlankPages', () => ({ useBlankPages: () => new Set() }))
vi.mock('../hooks/useDocInsights', () => ({ useDocInsights: () => ({ state: 'unavailable', insights: null }) }))

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'photo.png')
const Where = () => <p data-testid="where">{useLocation().pathname}</p>

// the demo server "converts" an upload for a moment before it is ready
async function upload(file) {
  const s = await mockApi.createSession()
  const d = await mockApi.uploadDocument(s.token, file, {})
  for (let i = 0; i < 100; i++) { const list = await mockApi.listDocuments(s.token); if (list.find((x) => x.id === d.id)?.status === 'ready') break; await new Promise((r) => setTimeout(r, 100)) }
  return { s, d }
}

async function open(file, path = 'edit') {
  const { s, d } = await upload(file)
  render(
    <MemoryRouter initialEntries={[`/s/${s.token}/${path}/${d.id}`]}>
      <Routes>
        <Route path="/s/:token" element={<SessionProvider />}>
          <Route path="edit/:docId" element={<Edit />} />
          <Route path="review/:docId" element={<Where />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  return { s, d }
}

test('a picture opens ONE screen with the placing area, the options and a Review button with the price', async () => {
  await open(PNG)
  expect(await screen.findByRole('heading', { name: 'Place your pictures' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Place photo\.png/ }).length).toBeGreaterThan(0)
  const review = await screen.findByRole('button', { name: /^Review · ₹/ }, { timeout: 4000 })
  await waitFor(() => expect(review).toBeEnabled())
  fireEvent.click(review)
  expect(await screen.findByTestId('where')).toHaveTextContent('/review/')
})

test('moving a picture does not ask for a new price', async () => {
  const spy = vi.spyOn(mockApi, 'quote')
  await open(PNG)
  await screen.findByRole('button', { name: /^Review · ₹/ }, { timeout: 4000 })
  const calls = spy.mock.calls.length
  fireEvent.keyDown(screen.getAllByRole('button', { name: /^Place photo\.png/ }).at(-1), { key: 'ArrowRight' })
  fireEvent.change(screen.getAllByLabelText(/^Size/)[0], { target: { value: '60' } })
  await new Promise((r) => setTimeout(r, 700))
  expect(spy.mock.calls.length).toBe(calls)
  spy.mockRestore()
}, 30000)

test('the old print-options address lands on the same screen', async () => {
  const { default: App } = await import('../App')
  const { s, d } = await upload(PNG)
  render(<MemoryRouter initialEntries={[`/s/${s.token}/configure/${d.id}`]}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Place your pictures' }, { timeout: 8000 })).toBeInTheDocument()
}, 30000)
