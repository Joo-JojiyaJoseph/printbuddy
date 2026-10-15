import { ApiError } from './errors'
import { mockApi } from './mockApi'

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'
export const IS_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

async function http(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }), ...(token && { 'X-Session-Token': token }) },
    body: body && JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed', data.errors)
  return data.data ?? data
}

function upload(path, { token, file, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', BASE + path)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('X-Session-Token', token)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* non-JSON */ }
      if (xhr.status < 300) resolve(data.data ?? data)
      else reject(new ApiError(xhr.status, data.message ?? 'Upload failed', data.errors))
    }
    xhr.onerror = () => reject(new ApiError(0, 'Network error. Check your connection and try again.'))
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

const real = {
  createSession: (kioskId) => http(`/kiosks/${kioskId}/sessions`, { method: 'POST' }),
  getSession: (token, { claim = false } = {}) => http(`/sessions/current${claim ? '?claim=1' : ''}`, { token }),
  listDocuments: (token) => http('/documents', { token }),
  uploadDocument: (token, file, { onProgress } = {}) => upload('/documents', { token, file, onProgress }),
  deleteDocument: (token, id) => http(`/documents/${id}`, { token, method: 'DELETE' }),
  quote: (token, payload) => http('/quotes', { token, method: 'POST', body: payload }),
  createOrder: (token, payload) => http('/orders', { token, method: 'POST', body: payload }),
  getOrder: (token, ref) => http(`/orders/${ref}`, { token }),
  createPayment: (token, ref) => http(`/orders/${ref}/payment`, { token, method: 'POST' }),
  getPayment: (token, ref) => http(`/orders/${ref}/payment`, { token }),
}

export const api = IS_MOCK ? mockApi : real
