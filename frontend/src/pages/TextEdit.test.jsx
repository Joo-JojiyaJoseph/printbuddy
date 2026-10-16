import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import TextEdit from './TextEdit'
import { api } from '../services/api'
import { ApiError } from '../services/errors'

const session = {
  token: 't', docs: [{ id: 'd1', status: 'ready', can_edit_text: true, edited: false }], docsLoaded: true, refresh: vi.fn().mockResolvedValue(),
}
vi.mock('../context/SessionContext', () => ({ useSession: () => session }))

const Where = () => <span data-testid="where">{useLocation().pathname}</span>
const mount = () => render(
  <MemoryRouter initialEntries={['/s/t/edit/d1/text']}>
    <Where />
    <Routes>
      <Route path="/s/:token/edit/:docId/text" element={<TextEdit />} />
      <Route path="/s/:token/edit/:docId" element={<div>edit page</div>} />
    </Routes>
  </MemoryRouter>,
)
afterEach(() => vi.restoreAllMocks())

test('opens the text, warns that a PDF is rebuilt from its text, and saves what is in the editor', async () => {
  vi.spyOn(api, 'getEditable').mockResolvedValue({ html: '<p>Hello world</p>', source: 'pdf', lossy: true })
  const save = vi.spyOn(api, 'saveDocumentContent').mockResolvedValue({})
  mount()
  expect(await screen.findByRole('note')).toHaveTextContent(/Pictures and the exact layout are not kept/)
  const frame = screen.getByTitle('Document text editor')
  await waitFor(() => expect(frame.contentDocument.body.innerHTML).toContain('Hello world'))
  frame.contentDocument.body.innerHTML = '<p>Hello edited world</p>'
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith('t', 'd1', '<p>Hello edited world</p>'))
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/s/t/edit/d1'))
})

test('Word documents get no lossy warning', async () => {
  vi.spyOn(api, 'getEditable').mockResolvedValue({ html: '<p>Hi</p>', source: 'word', lossy: false })
  mount()
  await screen.findByTitle('Document text editor')
  expect(screen.queryByRole('note')).toBeNull()
})

test('shows why text cannot be opened (e.g. scanned PDF) and still lets the customer leave', async () => {
  vi.spyOn(api, 'getEditable').mockRejectedValue(new ApiError(422, "This PDF has no selectable text (it may be a scan), so its text can't be edited."))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent(/no selectable text/)
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/s/t/edit/d1')
})

test('a failed save is shown and keeps the customer in the editor', async () => {
  vi.spyOn(api, 'getEditable').mockResolvedValue({ html: '<p>x</p>', source: 'word', lossy: false })
  vi.spyOn(api, 'saveDocumentContent').mockRejectedValue(new ApiError(409, 'This document is already part of an order and can no longer be edited.'))
  mount()
  await screen.findByTitle('Document text editor')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText(/already part of an order/)).toBeInTheDocument()
  expect(screen.getByTestId('where')).toHaveTextContent('/s/t/edit/d1/text')
})
