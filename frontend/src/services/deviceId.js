// A random id kept in this phone's browser. The first phone to scan owns the session; any other id gets HTTP 423.
export function deviceId() {
  try {
    let id = localStorage.getItem('pb_device')
    if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('pb_device', id) }
    return id
  } catch { return window.__pbDevice ??= Math.random().toString(36).slice(2).padEnd(20, 'x') + Date.now().toString(36) }
}
