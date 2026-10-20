import { ApiError } from '../services/errors'
import { IS_MOCK } from '../services/api'

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'
const KEY = 'tp_admin_token'
export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(KEY) } catch { return null } },
  set: (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY) } catch { /* storage blocked */ } },
}

const qs = (o = {}) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v === true ? '1' : v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function req(path, { method = 'GET', body, raw = false } = {}) {
  const t = tokenStore.get()
  const res = await fetch(`${BASE}/admin${path}`, {
    method,
    headers: { Accept: raw ? '*/*' : 'application/json', ...(body && { 'Content-Type': 'application/json' }), ...(t && { Authorization: `Bearer ${t}` }) },
    body: body && JSON.stringify(body),
  })
  if (res.status === 204) return null
  if (raw && res.ok) return res.blob()
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) tokenStore.set(null)
    const first = json.errors && Object.values(json.errors).flat()[0]
    throw new ApiError(res.status, first || json.message || 'Request failed', json.errors)
  }
  return json
}
const d = async (p, o) => (await req(p, o)).data

const real = {
  login: (email, password) => d('/login', { method: 'POST', body: { email, password } }),
  me: () => d('/me'),
  logout: () => req('/logout', { method: 'POST' }).catch(() => null),
  dashboard: () => d('/dashboard'),
  orders: (p) => req(`/orders${qs(p)}`),
  order: (ref) => d(`/orders/${ref}`),
  retryPrint: (ref) => d(`/orders/${ref}/print/retry`, { method: 'POST' }),
  cancelOrder: (ref) => d(`/orders/${ref}/cancel`, { method: 'POST' }),
  payments: (p) => req(`/payments${qs(p)}`),
  reconcile: (id) => d(`/payments/${id}/reconcile`, { method: 'POST' }),
  sessions: (p) => req(`/sessions${qs(p)}`),
  revokeSession: (id) => d(`/sessions/${id}/revoke`, { method: 'POST' }),
  integrations: () => d('/integrations'),
  saveIntegrations: (b) => d('/integrations', { method: 'PUT', body: b }),
  testPayment: () => d('/integrations/payment/test', { method: 'POST' }),
  printer: () => d('/printer'),
  selectPrinter: (name) => d('/printer', { method: 'PUT', body: { printer_name: name } }),
  testPrinter: () => d('/printer/test', { method: 'POST' }),
  kiosks: () => d('/kiosks'),
  createKiosk: (b) => d('/kiosks', { method: 'POST', body: b }),
  updateKiosk: (id, b) => d(`/kiosks/${id}`, { method: 'PUT', body: b }),
  sales: (p) => d(`/reports/sales${qs(p)}`),
  csv: (p) => req(`/reports/orders.csv${qs(p)}`, { raw: true }),
  pricing: () => d('/pricing'),
  savePricing: (b) => d('/pricing', { method: 'PUT', body: b }),
  settings: () => d('/settings'),
  saveSettings: (b) => d('/settings', { method: 'PUT', body: b }),
  users: () => d('/users'),
  createUser: (b) => d('/users', { method: 'POST', body: b }),
  updateUser: (id, b) => d(`/users/${id}`, { method: 'PUT', body: b }),
  deleteUser: (id) => req(`/users/${id}`, { method: 'DELETE' }),
  audit: (p) => req(`/audit${qs(p)}`),
}

/* ---------- Demo mode (no backend): realistic in-memory data so every screen can be tried. Login: admin@taprint.test / demo-password ---------- */
const MIN = 60000
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString()
const seed = () => {
  const names = ['Resume.pdf', 'Lecture-notes.pdf', 'Invoice-4821.pdf', 'Photo-id.jpg', 'Budget.xlsx', 'Thesis-ch3.docx', 'Slides.pptx', 'Ticket.png', 'Form-16.pdf']
  const kiosks = ['demo', 'lib-1', 'campus-2']
  const orders = Array.from({ length: 46 }, (_, i) => {
    const status = i % 11 === 7 ? 'cancelled' : i % 9 === 4 ? 'awaiting_payment' : 'paid'
    const failed = status === 'paid' && i % 13 === 5
    const pages = 1 + ((i * 7) % 24)
    const color = i % 3 === 0 ? 'color' : 'bw'
    const total = pages * (color === 'color' ? 800 : 200)
    const ago = i * 95 * MIN + 20 * MIN
    return {
      reference: `TP-${String(4800 + i).padStart(5, '0')}`, status, total_paise: total, currency: 'INR', document_name: names[i % names.length],
      pages, copies: 1 + (i % 3 === 1 ? 1 : 0), kiosk: kiosks[i % 3], paper: i % 8 === 3 ? 'A5' : 'A4', color,
      print_status: status === 'paid' ? (failed ? 'failed' : 'sent') : null, print_failure: failed ? 'The printer did not accept the job.' : null,
      payment_status: status === 'paid' ? 'succeeded' : status === 'cancelled' ? 'expired' : 'pending', paid_at: status === 'paid' ? iso(ago) : null, created_at: iso(ago + 3 * MIN),
    }
  })
  const payments = orders.filter((o) => o.status !== 'cancelled').map((o, i) => ({
    id: `pay-${i}`, order_reference: o.reference, order_status: o.status, provider: 'fake', provider_payment_id: `qr_${1000 + i}`, amount_paise: o.total_paise,
    currency: 'INR', status: o.payment_status, review_reason: i === 6 ? 'Amount received did not match the order' : null, expires_at: o.created_at, verified_at: o.paid_at, created_at: o.created_at,
  }))
  const sessions = Array.from({ length: 14 }, (_, i) => ({
    id: `ses-${i}`, kiosk: kiosks[i % 3], kiosk_name: `Kiosk ${kiosks[i % 3]}`, status: ['active', 'waiting', 'completed', 'completed', 'expired', 'cancelled'][i % 6],
    claimed_at: iso(i * 30 * MIN), expires_at: iso(i * 30 * MIN - 15 * MIN), documents_count: i % 4, orders_count: i % 3, created_at: iso(i * 30 * MIN + MIN),
  }))
  return {
    orders, payments, sessions,
    kiosks: [
      { id: 'k1', code: 'demo', name: 'Demo kiosk', location: 'Front desk', active: true, sessions_today: 6, url: '/kiosk?k=demo' },
      { id: 'k2', code: 'lib-1', name: 'Library kiosk', location: 'Ground floor', active: true, sessions_today: 3, url: '/kiosk?k=lib-1' },
      { id: 'k3', code: 'campus-2', name: 'Campus block B', location: 'Canteen side', active: false, sessions_today: 0, url: '/kiosk?k=campus-2' },
    ],
    users: [
      { id: 1, name: 'Admin', email: 'admin@taprint.test', role: 'admin', created_at: iso(900 * 60 * MIN) },
      { id: 2, name: 'Shop operator', email: 'operator@taprint.test', role: 'operator', created_at: iso(300 * 60 * MIN) },
      { id: 3, name: 'Accounts', email: 'accounts@taprint.test', role: 'viewer', created_at: iso(100 * 60 * MIN) },
    ],
    printer: { driver: 'file', driver_available: true, production_ready: false, printer: null, printer_from: 'default', installed_printers: ['HP LaserJet Pro M404', 'Canon MG3600 series', 'Microsoft Print to PDF'], installed_error: null, printer_found: true, poppler_available: true, jobs_24h: { sent: 11, failed: 1, in_progress: 0 }, recent_failures: [{ reference: 'TP-04805', reason: 'The printer did not accept the job.', at: iso(200 * MIN) }], scanner: { hardware_supported: false, note: 'Customers scan with their phone camera (uploaded as a photo). A USB/network scanner needs a small local agent and is not part of this build.' } },
    integrations: { provider: 'fake', key_id: '', key_secret_set: false, webhook_secret_set: false, print_driver: 'file', sumatra_path: '', lp_path: '', pdftoppm_path: '' },
    pricing: { rates: [{ id: 1, paper_size: 'A4', color_mode: 'bw', per_side_paise: 200, active: true }, { id: 2, paper_size: 'A4', color_mode: 'color', per_side_paise: 800, active: true }, { id: 3, paper_size: 'A5', color_mode: 'bw', per_side_paise: 120, active: true }, { id: 4, paper_size: 'A5', color_mode: 'color', per_side_paise: 500, active: true }], duplex_discount_bps: 1000, service_fee_paise: 0, tax_bps: 0, paper_sizes: ['A4', 'A5', 'Letter'], billing_policy: 'per printed side; duplex discount applies per side; tax on subtotal + fee' },
    settings: { session_ttl_minutes: 15, payment_ttl_minutes: 5, document_retention_hours: 24, max_upload_mb: 25, max_files: 10, max_pages: 500, max_copies: 100, allowed_types: ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'], paper_sizes: ['A4', 'A5', 'Letter'], all_types: ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'], conversion_driver: 'libreoffice', conversion_available: true, conversion_driver: 'none', payment_provider: 'fake' },
    audit: [{ id: 3, action: 'printer.test_sent', subject: 'Printer', user: 'Admin', meta: { driver: 'file' }, created_at: iso(40 * MIN) }, { id: 2, action: 'pricing.updated', subject: 'PricingRule', user: 'Admin', meta: null, created_at: iso(300 * MIN) }, { id: 1, action: 'admin.login', subject: 'User', user: 'Admin', meta: null, created_at: iso(600 * MIN) }],
  }
}
let M = seed()
export const resetDemo = () => { M = seed() }
const page = (rows, { page: pg = 1, per_page: per = 10 } = {}) => {
  const last = Math.max(1, Math.ceil(rows.length / per))
  const cur = Math.min(Math.max(1, Number(pg)), last)
  return { data: rows.slice((cur - 1) * per, cur * per), meta: { current_page: cur, last_page: last, per_page: per, total: rows.length } }
}
const has = (s, q) => !q || String(s ?? '').toLowerCase().includes(q.toLowerCase())
const me = () => M.users[0]
const log = (action, subject, meta = null) => M.audit.unshift({ id: Date.now(), action, subject, user: me().name, meta, created_at: new Date().toISOString() })
const fail = (status, message) => { throw new ApiError(status, message) }
let demoToken = null

const mock = {
  async login(email, password) {
    if (email !== 'admin@taprint.test' || password !== 'demo-password') fail(422, 'These credentials do not match our records.')
    demoToken = 'demo'
    return { token: demoToken, user: { id: 1, name: 'Admin', email, role: 'admin' } }
  },
  async me() { if (!tokenStore.get()) fail(401, 'Please sign in.'); return { id: 1, name: 'Admin', email: 'admin@taprint.test', role: 'admin' } },
  async logout() { return null },
  async dashboard() {
    const paid = M.orders.filter((o) => o.status === 'paid')
    const today = paid.filter((o) => Date.now() - new Date(o.paid_at) < 24 * 60 * MIN)
    const by = {}
    M.orders.forEach((o) => { by[o.status] = (by[o.status] || 0) + 1 })
    return { orders_today: M.orders.filter((o) => Date.now() - new Date(o.created_at) < 24 * 60 * MIN).length, paid_today: today.length, revenue_today_paise: today.reduce((s, o) => s + o.total_paise, 0), revenue_total_paise: paid.reduce((s, o) => s + o.total_paise, 0), active_sessions: M.sessions.filter((s) => s.status === 'active' || s.status === 'waiting').length, pending_payments: M.payments.filter((p) => p.status === 'pending').length, payments_needing_review: M.payments.filter((p) => p.review_reason).length, failed_conversions: 0, converting: 0, documents_due_for_purge: 2, documents_on_disk: 17, storage_bytes: 48_300_000, conversion_available: true, conversion_driver: 'none', payment_provider: 'fake', print_failed: M.orders.filter((o) => o.print_status === 'failed').length, orders_by_status: by }
  },
  async orders(p = {}) { return page(M.orders.filter((o) => (!p.status || o.status === p.status) && (has(o.reference, p.q) || has(o.document_name, p.q))), p) },
  async order(ref) {
    const o = M.orders.find((x) => x.reference === ref) || fail(404, 'Order not found.')
    return { ...o, settings: { copies: o.copies, paper_size: o.paper, color_mode: o.color, duplex: false, orientation: 'portrait', scaling: 'fit', pages_per_sheet: 1, page_range: '' }, pricing_snapshot: { pages_selected: o.pages, billable_sides: o.pages * o.copies }, document: { name: o.document_name, kind: o.document_name.split('.').pop(), page_count: o.pages, size_bytes: 240000, status: 'ready' }, session: { status: 'completed' }, payments: M.payments.filter((p) => p.order_reference === ref) }
  },
  async retryPrint(ref) { const o = M.orders.find((x) => x.reference === ref); if (o?.print_status !== 'failed') fail(409, 'Only a failed print can be retried.'); o.print_status = 'sent'; o.print_failure = null; log('print.retry', 'PrintOrder', { reference: ref }); return o },
  async cancelOrder(ref) { const o = M.orders.find((x) => x.reference === ref); if (o.status !== 'awaiting_payment') fail(409, 'Only an unpaid order can be cancelled.'); o.status = 'cancelled'; log('order.cancelled', 'PrintOrder', { reference: ref }); return o },
  async payments(p = {}) { return page(M.payments.filter((x) => (!p.status || x.status === p.status) && (!p.needs_review || x.review_reason) && (has(x.order_reference, p.q) || has(x.provider_payment_id, p.q))), p) },
  async reconcile(id) { const x = M.payments.find((y) => y.id === id); log('payment.reconcile_requested', 'Payment'); return x },
  async sessions(p = {}) { return page(M.sessions.filter((s) => !p.status || s.status === p.status), p) },
  async revokeSession(id) { const s = M.sessions.find((x) => x.id === id); s.status = 'cancelled'; log('session.revoked', 'QrSession'); return s },
  async integrations() {
    const i = M.integrations
    return {
      payment: { provider: i.provider, from: 'admin', key_id: i.key_id, mode: i.key_id.startsWith('rzp_live_') ? 'live' : i.key_id.startsWith('rzp_test_') ? 'test' : null, key_secret_set: i.key_secret_set, webhook_secret_set: i.webhook_secret_set, webhook_url: `${window.location.origin}/api/v1/webhooks/razorpay`, webhook_event: 'qr_code.credited and order.paid', production: false },
      printing: { driver: i.print_driver, from: 'admin', sumatra_path: i.sumatra_path, lp_path: i.lp_path, pdftoppm_path: i.pdftoppm_path, detected: { sumatra: null, lp: '/usr/bin/lp', pdftoppm: '/usr/bin/pdftoppm' }, os: 'Linux', production: false },
    }
  },
  async saveIntegrations(b) {
    const i = M.integrations
    const bad = (field, message) => { const e = new ApiError(422, message); e.errors = { [field]: [message] }; throw e }
    if (b.razorpay_key_id && !/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/.test(b.razorpay_key_id)) bad('razorpay_key_id', 'The Key ID looks like rzp_test_… or rzp_live_….')
    if (b.razorpay_webhook_secret && b.razorpay_webhook_secret.length < 16) bad('razorpay_webhook_secret', 'Use at least 16 characters for the webhook secret.')
    for (const [f, name] of [['sumatra_path', 'sumatrapdf'], ['lp_path', 'lp'], ['pdftoppm_path', 'pdftoppm']]) {
      const v = (b[f] ?? '').trim()
      if (v && !/^(\/|[A-Za-z]:[\\/])/.test(v)) bad(f, 'Enter the full path to the program.')
      if (v && v.replace(/^.*[\\/]/, '').replace(/\.(exe|com|bat)$/i, '').toLowerCase() !== name) bad(f, `That file should be named ${name}.`)
    }
    const next = { ...i }
    if ('payment_provider' in b) next.provider = b.payment_provider || 'fake'
    if ('razorpay_key_id' in b) next.key_id = b.razorpay_key_id.trim()
    if (b.razorpay_key_secret) next.key_secret_set = true
    if (b.razorpay_webhook_secret) next.webhook_secret_set = true
    ;(b.clear || []).forEach((k) => { if (k === 'razorpay_key_secret') next.key_secret_set = false; if (k === 'razorpay_webhook_secret') next.webhook_secret_set = false; if (k === 'razorpay_key_id') next.key_id = '' })
    if ('print_driver' in b) next.print_driver = b.print_driver || 'file'
    ;['sumatra_path', 'lp_path', 'pdftoppm_path'].forEach((k) => { if (k in b) next[k] = b[k].trim() })
    if (next.provider === 'razorpay') {
      const gaps = [!next.key_id && 'Razorpay Key ID', !next.key_secret_set && 'Razorpay Key Secret'].filter(Boolean)
      if (gaps.length) bad('payment_provider', `Razorpay needs: ${gaps.join(', ')}.`)
    }
    M.integrations = next
    M.printer.driver = next.print_driver; M.printer.production_ready = next.print_driver !== 'file'
    log('integrations.updated', 'Integrations', { fields: Object.keys(b) })
    return mock.integrations()
  },
  async testPayment() {
    const i = M.integrations
    if (i.provider !== 'razorpay') fail(422, 'Razorpay is not the selected payment provider.')
    if (!i.key_id || !i.key_secret_set) fail(422, 'Save the Key ID and Key Secret first.')
    return { ok: true, message: 'Demo mode: no request was sent to Razorpay.' }
  },
  async printer() { return structuredClone(M.printer) },
  async selectPrinter(name) {
    if (/^[-;]|[\n;]/.test(name)) fail(422, 'That printer name contains characters that are not allowed.')
    M.printer.printer = name || null; M.printer.printer_from = name ? 'admin' : 'default'; M.printer.printer_found = !name || M.printer.installed_printers.includes(name)
    log('printer.selected', 'Printer', { after: name }); return structuredClone(M.printer)
  },
  async testPrinter() { log('printer.test_sent', 'Printer', { driver: M.printer.driver }); return { ok: true, job_id: 'TEST.pdf', driver: M.printer.driver, note: 'Development driver: the PDF was saved to a folder, nothing was printed.' } },
  async kiosks() { return structuredClone(M.kiosks) },
  async createKiosk(b) { if (M.kiosks.some((k) => k.code === b.code)) fail(422, 'That code is already used.'); const k = { id: `k${Date.now()}`, ...b, active: true, sessions_today: 0, url: `/kiosk?k=${b.code}` }; M.kiosks.push(k); log('kiosk.created', 'Kiosk'); return k },
  async updateKiosk(id, b) { const k = M.kiosks.find((x) => x.id === id); Object.assign(k, b); log('kiosk.updated', 'Kiosk'); return k },
  async sales({ from, to } = {}) { return salesFrom(M.orders, from, to) },
  async csv({ from, to } = {}) {
    const rows = M.orders.filter((o) => o.status === 'paid')
    return new Blob([`﻿Reference,Paid at,Kiosk,Document,Pages,Total (INR)\r\n${rows.map((o) => [o.reference, o.paid_at, o.kiosk, o.document_name, o.pages, (o.total_paise / 100).toFixed(2)].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')}\r\n`], { type: 'text/csv' })
  },
  async pricing() { return structuredClone(M.pricing) },
  async savePricing(b) { M.pricing = { ...M.pricing, ...b, rates: b.rates.map((r, i) => ({ id: i + 1, active: true, ...r })) }; log('pricing.updated', 'PricingRule'); return structuredClone(M.pricing) },
  async settings() { return structuredClone(M.settings) },
  async saveSettings(b) { Object.assign(M.settings, b); log('settings.updated', 'Setting'); return structuredClone(M.settings) },
  async users() { return structuredClone(M.users) },
  async createUser(b) { if (M.users.some((u) => u.email === b.email)) fail(422, 'That e-mail is already used.'); const u = { id: Date.now(), created_at: new Date().toISOString(), ...b }; delete u.password; M.users.push(u); log('user.created', 'User'); return u },
  async updateUser(id, b) {
    const u = M.users.find((x) => x.id === id)
    if (b.role && b.role !== 'admin' && u.role === 'admin' && M.users.filter((x) => x.role === 'admin').length <= 1) fail(409, 'There must be at least one admin.')
    Object.assign(u, { ...b, password: undefined }); log('user.updated', 'User'); return u
  },
  async deleteUser(id) { if (id === 1) fail(409, 'You cannot delete your own account.'); M.users = M.users.filter((u) => u.id !== id); log('user.deleted', 'User'); return null },
  async audit(p = {}) { return page(M.audit.filter((a) => has(a.action, p.q)), p) },
}

/** Same aggregation as the server's ReportBuilder, so the demo shows what production will. */
export function salesFrom(orders, from, to) {
  const end = new Date(`${to || new Date().toISOString().slice(0, 10)}T00:00:00`)
  const start = new Date(`${from || new Date(end.getTime() - 29 * 864e5).toISOString().slice(0, 10)}T00:00:00`)
  const day = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  const daily = {}
  for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) daily[day(t)] = { date: day(t), orders: 0, revenue_paise: 0 }
  const grp = { paper: {}, color: {}, kiosk: {} }
  let n = 0, rev = 0, sides = 0
  orders.filter((o) => o.status === 'paid').forEach((o) => {
    const k = day(new Date(o.paid_at))
    if (!daily[k]) return
    n++; rev += o.total_paise; sides += o.pages * o.copies
    daily[k].orders++; daily[k].revenue_paise += o.total_paise
    ;[['paper', o.paper], ['color', o.color], ['kiosk', o.kiosk]].forEach(([g, key]) => { const e = (grp[g][key] ||= { key, orders: 0, revenue_paise: 0 }); e.orders++; e.revenue_paise += o.total_paise })
  })
  const rank = (g) => Object.values(g).sort((a, b) => b.revenue_paise - a.revenue_paise)
  return { from: day(start), to: day(end), totals: { orders: n, revenue_paise: rev, billable_sides: sides, average_order_paise: n ? Math.floor(rev / n) : 0 }, daily: Object.values(daily), by_paper: rank(grp.paper), by_color: rank(grp.color), by_kiosk: rank(grp.kiosk) }
}

export const adminApi = IS_MOCK ? mock : real
