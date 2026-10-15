import { ApiError } from './errors'
import { validateFile, LIMITS } from '../utils/fileValidation'
import { quoteFor, RULES } from './mockPricing'

// In-browser stand-in for the Laravel API (same contract as docs/openapi.yaml).
// Sessions persist in localStorage so a QR link opened in a second tab works; documents stay in memory.
const KEY = 'pb_mock_sessions'
const TTL_MS = 10 * 60 * 1000
const docs = new Map()
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} } }
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ } }
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
const objectUrl = (f) => { try { return URL.createObjectURL(f) } catch { return null } }

function activeSession(token) {
  const s = load()[token]
  if (!s) throw new ApiError(404, 'Session not found.')
  if (Date.parse(s.expires_at) < Date.now()) throw new ApiError(410, 'This session has expired.')
  return s
}

async function finalize(token, doc, file) {
  const list = docs.get(token) ?? []
  const live = list.find((d) => d.id === doc.id)
  if (!live) return
  if (doc.kind === 'pdf') {
    try {
      const { loadPdfjs } = await import('../utils/pdf')
      const pdfjs = await loadPdfjs()
      const pdf = await pdfjs.getDocument(URL.createObjectURL(file)).promise
      Object.assign(live, { page_count: pdf.numPages, preview_url: objectUrl(file), status: 'ready' })
    } catch {
      Object.assign(live, { status: 'failed', failure_reason: 'This PDF could not be read. It may be damaged or password-protected.' })
    }
  } else if (doc.kind === 'jpg' || doc.kind === 'png') {
    Object.assign(live, { page_count: 1, preview_url: objectUrl(file), status: 'ready' })
  } else {
    Object.assign(live, { status: 'failed', failure_reason: 'Office and text files are converted by the backend, which is not running in demo mode.' })
  }
}

export const mockApi = {
  async createSession() {
    await delay(150)
    const token = hex()
    const s = { id: hex().slice(0, 12), token, status: 'active', kiosk: { name: 'Kiosk #12' },
      expires_at: new Date(Date.now() + TTL_MS).toISOString(), claimed_at: null }
    save({ ...load(), [token]: s })
    return s
  },
  async getSession(token, { claim = false } = {}) {
    await delay(80)
    const s = activeSession(token)
    if (claim && !s.claimed_at) { s.claimed_at = new Date().toISOString(); save({ ...load(), [token]: s }) }
    return s
  },
  async listDocuments(token) {
    activeSession(token)
    return (docs.get(token) ?? []).map((d) => ({ ...d }))
  },
  async uploadDocument(token, file, { onProgress } = {}) {
    activeSession(token)
    const list = docs.get(token) ?? []
    if (list.length >= LIMITS.maxFiles) throw new ApiError(422, `You can add up to ${LIMITS.maxFiles} files per session.`)
    const v = await validateFile(file, list.length)
    if (!v.ok) throw new ApiError(415, v.error)
    for (const p of [25, 55, 80, 100]) { await delay(60); onProgress?.(p) }
    const doc = { id: hex().slice(0, 12), original_name: file.name, kind: v.kind, size_bytes: file.size,
      status: 'converting', page_count: null, preview_url: null, failure_reason: null }
    docs.set(token, [...list, doc])
    setTimeout(() => finalize(token, doc, file), 500)
    return { ...doc }
  },
  async deleteDocument(token, id) {
    activeSession(token)
    const list = docs.get(token) ?? []
    const d = list.find((x) => x.id === id)
    if (d?.preview_url) { try { URL.revokeObjectURL(d.preview_url) } catch { /* noop */ } }
    docs.set(token, list.filter((x) => x.id !== id))
  },
  async quote(token, { document_id, settings }) {
    await delay(120)
    activeSession(token)
    const d = (docs.get(token) ?? []).find((x) => x.id === document_id)
    if (!d) throw new ApiError(404, 'Document not found in this session.')
    if (d.status !== 'ready') throw new ApiError(409, 'Document is not ready yet.')
    try { return quoteFor(d.page_count, settings) } catch (e) { throw new ApiError(422, e.message) }
  },
}

// ---- Orders and payments (mirror of backend OrderStateMachine + PaymentProcessor rules) ----
const orders = new Map()     // reference -> order (each remembers its owning session token)
const payments = new Map()   // reference -> our payment record
const provider = new Map()   // reference -> what the "bank/provider" says (source of truth)
const seenEvents = new Set() // webhook idempotency
const PAYMENT_TTL_MS = 5 * 60 * 1000
const TRANSITIONS = {
  configured: ['awaiting_payment', 'cancelled', 'expired'],
  awaiting_payment: ['paid', 'payment_failed', 'expired', 'cancelled'],
  payment_failed: ['awaiting_payment', 'cancelled', 'expired'],
  paid: [], expired: [], cancelled: [],
}
const move = (order, to) => {
  if (!TRANSITIONS[order.status]?.includes(to)) throw new ApiError(409, `Invalid order transition ${order.status} -> ${to}.`)
  order.status = to
}
const refCode = () => 'PB-' + hex().slice(0, 6).toUpperCase()
const upiUri = (ref, paise) => `upi://pay?pa=sandbox@upi&pn=PrintBuddy&am=${(paise / 100).toFixed(2)}&cu=INR&tr=${ref}`
const ownedOrder = (token, ref) => {
  activeSession(token)
  const o = orders.get(ref)
  if (!o || o.token !== token) throw new ApiError(404, 'Order not found.') // same answer for "missing" and "someone else's"
  return o
}
const publicOrder = ({ token: _t, ...o }) => ({ ...o })
const publicPayment = (p) => ({ ...p })

/** Server-side verification: only the provider's record can mark an order paid, and only if the amount matches. */
function verify(ref) {
  const order = orders.get(ref), pay = payments.get(ref), remote = provider.get(ref)
  if (!order || !pay) return 'unknown'
  if (pay.status === 'pending' && Date.parse(pay.expires_at) < Date.now() && remote?.status !== 'succeeded') {
    pay.status = 'expired'
    if (order.status === 'awaiting_payment') move(order, 'expired')
    return 'expired'
  }
  if (!remote || remote.status === 'pending') return 'pending'
  if (remote.amount_paise !== pay.amount_paise || pay.amount_paise !== order.total_paise) return 'mismatch'
  if (remote.status === 'succeeded') {
    if (order.status === 'paid') return 'already_paid'
    if (order.status !== 'awaiting_payment') return 'needs_review'
    pay.status = 'succeeded'; pay.verified_at = new Date().toISOString()
    move(order, 'paid'); order.paid_at = pay.verified_at
    return 'paid'
  }
  if (remote.status === 'failed' && order.status === 'awaiting_payment') {
    pay.status = 'failed'; move(order, 'payment_failed')
    return 'failed'
  }
  return 'ignored'
}

mockApi.createOrder = async (token, { document_id, settings }) => {
  await delay(120)
  activeSession(token)
  const d = (docs.get(token) ?? []).find((x) => x.id === document_id)
  if (!d || d.status !== 'ready') throw new ApiError(409, 'Document is not ready.')
  let q
  try { q = quoteFor(d.page_count, settings) } catch (e) { throw new ApiError(422, e.message) }
  const order = {
    token, reference: refCode(), status: 'configured', currency: 'INR', paid_at: null,
    created_at: new Date().toISOString(),
    document: { id: d.id, name: d.original_name, page_count: d.page_count },
    settings: { ...settings },
    pricing_snapshot: { ...q, rules_snapshot: structuredClone(RULES) },
    total_paise: q.total_paise,
  }
  orders.set(order.reference, order)
  return publicOrder(order)
}
mockApi.getOrder = async (token, ref) => { await delay(60); return publicOrder(ownedOrder(token, ref)) }
mockApi.createPayment = async (token, ref) => {
  await delay(120)
  const order = ownedOrder(token, ref)
  const existing = payments.get(ref)
  if (existing?.status === 'pending' && Date.parse(existing.expires_at) > Date.now()) {
    return { payment: publicPayment(existing), order_status: order.status } // idempotent re-open
  }
  if (!['configured', 'payment_failed', 'awaiting_payment'].includes(order.status)) throw new ApiError(409, `Order is ${order.status}.`)
  const pay = { id: 'mock_pay_' + hex().slice(0, 8), order_reference: ref, amount_paise: order.total_paise, currency: 'INR',
    status: 'pending', upi_uri: upiUri(ref, order.total_paise), expires_at: new Date(Date.now() + PAYMENT_TTL_MS).toISOString(), verified_at: null }
  payments.set(ref, pay)
  provider.set(ref, { status: 'pending', amount_paise: pay.amount_paise })
  if (order.status !== 'awaiting_payment') move(order, 'awaiting_payment')
  return { payment: publicPayment(pay), order_status: order.status }
}
mockApi.getPayment = async (token, ref) => {
  await delay(60)
  const order = ownedOrder(token, ref)
  verify(ref)
  return { payment: publicPayment(payments.get(ref)), order_status: order.status }
}

/** Sandbox-only controls (absent from the real API client). They act on the fake PROVIDER, never on our order. */
mockApi.sandbox = {
  deliverWebhook(ref, eventId = 'evt_' + hex().slice(0, 8)) {
    if (seenEvents.has(eventId)) return { result: 'duplicate', eventId }
    seenEvents.add(eventId)
    return { result: verify(ref), eventId }
  },
  customerPays(ref, { amountPaise, fail = false } = {}) {
    const pay = payments.get(ref)
    provider.set(ref, { status: fail ? 'failed' : 'succeeded', amount_paise: amountPaise ?? pay.amount_paise })
    return this.deliverWebhook(ref)
  },
  expire(ref) { const p = payments.get(ref); if (p) p.expires_at = new Date(Date.now() - 1000).toISOString() },
}
