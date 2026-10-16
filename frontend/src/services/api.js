import { ApiError } from './errors'
import { mockApi } from './mockApi'
import { deviceId } from './deviceId'

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'
export const IS_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const SLOW_DOWN = 'You are going a little fast. Please wait a few seconds and try again.'

async function http(path, opts = {}, retried = false) {
  const { token, method = 'GET', body, kiosk = false } = opts
  const res = await fetch(BASE + path, {
    method,
    headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }), ...(token && { 'X-Session-Token': token, ...(!kiosk && { 'X-Device-Id': deviceId() }) }) },
    body: body && JSON.stringify(body),
  })
  if (res.status === 204) return null
  // Too many requests: the server rejected this one without doing anything, so waiting and retrying once is safe.
  if (res.status === 429 && !retried) {
    const secs = Number(res.headers.get('Retry-After')) || 2
    await wait(Math.min(Math.max(secs, 1), 6) * 1000)
    return http(path, opts, true)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, res.status === 429 ? SLOW_DOWN : data.message ?? 'Request failed', data.errors)
  return data.data ?? data
}

function upload(path, { token, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', BASE + path)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-Session-Token', token)
    xhr.setRequestHeader('X-Device-Id', deviceId())
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON */ }
      if (xhr.status < 300) resolve(data.data ?? data)
      else reject(new ApiError(xhr.status, xhr.status === 429 ? SLOW_DOWN : data.message ?? 'Upload failed', data.errors))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Network error. Check your connection and try again.'))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

const real = {
  createSession: (kioskId) => http(`/kiosks/${kioskId}/sessions`, { method: 'POST' }),
  getSession: (token, { claim = false } = {}) => http(`/sessions/current${claim ? '?claim=1' : ''}`, { token, kiosk: !claim }),
  endSession: (token) => http('/sessions/current/end', { token, method: 'POST', kiosk: true }),
  listDocuments: (token) => http('/documents', { token }),
  uploadDocument: (token, file, { onProgress } = {}) => upload('/documents', { token, file, onProgress }),
  deleteDocument: (token, id) => http(`/documents/${id}`, { token, method: 'DELETE' }),
  quote: (token, payload) => http('/quotes', { token, method: 'POST', body: payload }),
  createOrder: (token, payload) => http('/orders', { token, method: 'POST', body: payload }),
  getOrder: (token, ref) => http(`/orders/${ref}`, { token }),
  createPayment: (token, ref) => http(`/orders/${ref}/payment`, { token, method: 'POST' }),
  getPayment: (token, ref) => http(`/orders/${ref}/payment`, { token }),
  mergeDocuments: (token, ids) => http('/documents/merge', { token, method: 'POST', body: { document_ids: ids } }),
  getEditable: (token, id) => http(`/documents/${id}/editable`, { token, method: 'POST' }),
  saveDocumentContent: (token, id, html) => http(`/documents/${id}/content`, { token, method: 'PUT', body: { html } }),
  revertDocument: (token, id) => http(`/documents/${id}/revert`, { token, method: 'POST' }),
}

export const api = IS_MOCK ? mockApi : real
