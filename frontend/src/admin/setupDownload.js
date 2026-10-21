import { adminApi } from './adminApi'

/** Makes a fresh print key for the kiosk and saves the ready-to-run shop PC package. Returns false when the admin cancels. */
export async function downloadShopSetup(k) {
  const warn = k.agent?.key_set ? ' The kiosk’s current print key stops working, so the program already running on that shop PC must be replaced with this one.' : ''
  if (!window.confirm(`Download the setup for ${k.name}? This makes a new print key.${warn}`)) return false
  const blob = await adminApi.kioskSetup(k.id)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `taprint-print-agent-${String(k.code).replace(/[^A-Za-z0-9_-]/g, '')}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return true
}
