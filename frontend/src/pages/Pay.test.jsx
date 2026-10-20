import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SessionProvider from '../context/SessionContext'
import Pay from './Pay'
import Done from './Done'
import { mockApi as api } from '../services/mockApi'
import * as razorpay from '../utils/razorpay'

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
  expect(await screen.findByText(/Privacy: your files are deleted/, {}, { timeout: 9000 })).toBeInTheDocument()
}, 14000)

describe('Razorpay card / netbanking window', () => {
  afterEach(() => vi.restoreAllMocks())
  const CHECKOUT = { key_id: 'rzp_test_x', provider_order_id: 'order_1', amount_paise: 400, currency: 'INR', name: 'Taprint', description: 'Print order' }

  test('is offered next to the UPI QR, and in the demo it completes the payment', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Card, netbanking or wallet/ }))
    expect(await screen.findByTestId('order-ref', {}, { timeout: 3000 })).toBeInTheDocument()
  })

  test('opens the window with what the server made, then reports the result to the server', async () => {
    const order = await setup()
    vi.spyOn(api, 'createCheckout').mockResolvedValue({ checkout: CHECKOUT, payment: {} })
    const open = vi.spyOn(razorpay, 'payWithCheckout').mockResolvedValue({ provider_order_id: 'order_1', provider_payment_id: 'pay_1', signature: 'sig' })
    const confirm = vi.spyOn(api, 'confirmCheckout').mockResolvedValue({ payment: { status: 'pending' } })
    fireEvent.click(await screen.findByRole('button', { name: /Card, netbanking or wallet/ }))
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    expect(open).toHaveBeenCalledWith(CHECKOUT)
    expect(confirm.mock.calls[0][1]).toBe(order.reference)
    expect(confirm.mock.calls[0][2]).toEqual({ provider_order_id: 'order_1', provider_payment_id: 'pay_1', signature: 'sig' })
    expect(screen.getByText('Confirming your payment…')).toBeInTheDocument() // nothing is "paid" until the server says so
    expect(screen.queryByTestId('order-ref')).not.toBeInTheDocument()
  })

  test('closing the window is not an error and does not charge anything', async () => {
    await setup()
    vi.spyOn(api, 'createCheckout').mockResolvedValue({ checkout: CHECKOUT, payment: {} })
    vi.spyOn(razorpay, 'payWithCheckout').mockRejectedValue(new Error('closed'))
    const confirm = vi.spyOn(api, 'confirmCheckout')
    fireEvent.click(await screen.findByRole('button', { name: /Card, netbanking or wallet/ }))
    expect(await screen.findByText(/window was closed. You have not been charged/)).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('when the account has no UPI QR, the window is the way to pay (no QR, no UPI app buttons)', async () => {
    const real = api.createPayment
    vi.spyOn(api, 'createPayment').mockImplementation(async (...a) => {
      const r = await real(...a)
      return { ...r, payment: { ...r.payment, method: 'checkout', upi_uri: null, qr_image_url: null }, checkout_available: true }
    })
    await setup()
    expect(await screen.findByRole('button', { name: /Pay with card, netbanking, wallet or UPI/ })).toBeInTheDocument()
    expect(screen.queryByText(/Google Pay/)).not.toBeInTheDocument()
    expect(screen.queryByTitle('UPI payment QR code')).not.toBeInTheDocument()
  })
})
