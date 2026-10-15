import { mockApi as api } from './mockApi'
import { ApiError } from './errors'

const PNG = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'p.png')
const S = { page_range: '', copies: 3, color_mode: 'bw', paper_size: 'A4', orientation: 'portrait', duplex: false, scaling: 'fit' }

async function readyOrder(token) {
  const t = token ?? (await api.createSession()).token
  await api.uploadDocument(t, PNG)
  let doc
  for (let i = 0; i < 40 && doc?.status !== 'ready'; i++) { await new Promise((r) => setTimeout(r, 100)); doc = (await api.listDocuments(t))[0] }
  const order = await api.createOrder(t, { document_id: doc.id, settings: S })
  return { t, order }
}

test('order total is the server price and carries a pricing snapshot', async () => {
  const { order } = await readyOrder()
  expect(order.total_paise).toBe(3 * 200)
  expect(order.pricing_snapshot.rules_snapshot.rates.length).toBeGreaterThan(0)
  expect(order.status).toBe('configured')
})

test('another session cannot read the order (no IDOR)', async () => {
  const { order } = await readyOrder()
  const other = await api.createSession()
  await expect(api.getOrder(other.token, order.reference)).rejects.toMatchObject({ status: 404 })
})

test('payment is for the exact order amount and only becomes paid after provider verification', async () => {
  const { t, order } = await readyOrder()
  const { payment } = await api.createPayment(t, order.reference)
  expect(payment.amount_paise).toBe(order.total_paise)
  expect((await api.getPayment(t, order.reference)).order_status).toBe('awaiting_payment')
  expect(api.sandbox.customerPays(order.reference).result).toBe('paid')
  const after = await api.getPayment(t, order.reference)
  expect([after.payment.status, after.order_status]).toEqual(['succeeded', 'paid'])
  expect((await api.getOrder(t, order.reference)).paid_at).toBeTruthy()
})

test('underpayment is never marked paid', async () => {
  const { t, order } = await readyOrder()
  await api.createPayment(t, order.reference)
  expect(api.sandbox.customerPays(order.reference, { amountPaise: 100 }).result).toBe('mismatch')
  expect((await api.getOrder(t, order.reference)).status).toBe('awaiting_payment')
})

test('duplicate webhook delivery is idempotent', async () => {
  const { t, order } = await readyOrder()
  await api.createPayment(t, order.reference)
  const first = api.sandbox.customerPays(order.reference)
  expect(api.sandbox.deliverWebhook(order.reference, first.eventId).result).toBe('duplicate')
  expect(api.sandbox.deliverWebhook(order.reference).result).toBe('already_paid')
})

test('failed payment can be retried with a new payment; paid orders cannot', async () => {
  const { t, order } = await readyOrder()
  const first = (await api.createPayment(t, order.reference)).payment
  expect(api.sandbox.customerPays(order.reference, { fail: true }).result).toBe('failed')
  expect((await api.getOrder(t, order.reference)).status).toBe('payment_failed')
  const second = (await api.createPayment(t, order.reference)).payment
  expect(second.id).not.toBe(first.id)
  api.sandbox.customerPays(order.reference)
  await expect(api.createPayment(t, order.reference)).rejects.toBeInstanceOf(ApiError)
})

test('expired payment expires the order and is not payable', async () => {
  const { t, order } = await readyOrder()
  await api.createPayment(t, order.reference)
  api.sandbox.expire(order.reference)
  const r = await api.getPayment(t, order.reference)
  expect([r.payment.status, r.order_status]).toEqual(['expired', 'expired'])
})
