import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SessionProvider from '../context/SessionContext'
import Pay from './Pay'
import Done from './Done'
import { mockApi as api } from '../services/mockApi'

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'p.png')
const S = { page_range: '', copies: 2, color_mode: 'bw', paper_size: 'A4', orientation: 'portrait', duplex: false, scaling: 'fit' }

async function setup() {
  const { token } = await api.createSession()
  await api.uploadDocument(token, PNG)
  let doc
  for (let i = 0; i < 40 && doc?.status !== 'ready'; i++) { await new Promise((r) => setTimeout(r, 100)); doc = (await api.listDocuments(token))[0] }
  const order = await api.createOrder(token, { document_id: doc.id, settings: S })
  render(
    <MemoryRouter initialEntries={[`/s/${token}/pay/${order.reference}`]}>
      <Routes><Route path="/s/:token" element={<SessionProvider />}>
        <Route path="pay/:ref" element={<Pay />} /><Route path="done/:ref" element={<Done />} />
      </Route></Routes>
    </MemoryRouter>
  )
  return order
}

test('shows the exact server amount, then confirmation only after verified payment', async () => {
  const order = await setup()
  expect(await screen.findByText('₹4.00')).toBeInTheDocument() // 2 copies x 1 page x ₹2
  expect(screen.getByText('Waiting for payment…')).toBeInTheDocument()
  expect(screen.queryByTestId('order-ref')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Customer pays' }))
  expect(await screen.findByTestId('order-ref', {}, { timeout: 3000 })).toBeInTheDocument()
  expect(screen.getByTestId('order-ref')).toHaveTextContent(order.reference)
})

test('underpayment keeps the customer on the payment screen', async () => {
  await setup()
  await screen.findByText('Waiting for payment…')
  fireEvent.click(screen.getByRole('button', { name: 'Underpays ₹1' }))
  await new Promise((r) => setTimeout(r, 300))
  expect(screen.getByText('Waiting for payment…')).toBeInTheDocument()
  expect(screen.queryByTestId('order-ref')).not.toBeInTheDocument()
})

test('failed and expired states offer a way forward', async () => {
  await setup()
  await screen.findByText('Waiting for payment…')
  fireEvent.click(screen.getByRole('button', { name: 'Payment fails' }))
  expect(await screen.findByText('Payment failed.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Waiting for payment…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Let it expire' }))
  expect(await screen.findByText('Payment expired.')).toBeInTheDocument()
})

test('shows Pay now, UPI app buttons and, last, the QR code to scan', async () => {
  await setup()
  await screen.findByText('Waiting for payment…')
  expect(screen.getByRole('link', { name: /Pay now/ }).getAttribute('href')).toMatch(/^upi:\/\/pay\?/)
  for (const name of ['Google Pay', 'PhonePe', 'Paytm', 'BHIM']) expect(screen.getByRole('link', { name })).toBeInTheDocument()
  expect(screen.getByTitle('UPI payment QR code')).toBeInTheDocument()
  expect(screen.getByText(/scan this QR code with any UPI app/i)).toBeInTheDocument()
})

test('after a verified payment the page shows printing progress and then "sent"', async () => {
  await setup()
  await screen.findByText('Waiting for payment…')
  fireEvent.click(screen.getByRole('button', { name: 'Customer pays' }))
  expect(await screen.findByTestId('print-status', {}, { timeout: 3000 })).toHaveTextContent(/Printing…|Sent to the printer/)
  expect(await screen.findByText('Sent to the printer', {}, { timeout: 8000 })).toBeInTheDocument()
}, 12000)

test('after printing, the confirmation promises the files are erased', async () => {
  await setup()
  await screen.findByText('Waiting for payment…')
  fireEvent.click(screen.getByRole('button', { name: 'Customer pays' }))
  expect(await screen.findByText(/Privacy: your files are erased/, {}, { timeout: 9000 })).toBeInTheDocument()
}, 14000)
