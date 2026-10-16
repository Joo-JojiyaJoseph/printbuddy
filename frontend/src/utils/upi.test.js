import { upiLinks, canOpenUpiApps } from './upi'

const URI = 'upi://pay?pa=shop@upi&pn=Taprint&am=4.00&cu=INR&tr=PB-1'

test('builds one link per UPI app carrying the server payment details', () => {
  const l = upiLinks(URI)
  expect(l.any).toBe(URI)
  expect(l.apps.map((a) => a.id)).toEqual(['gpay', 'phonepe', 'paytm', 'bhim'])
  for (const a of l.apps) expect(a.href).toContain('pay?pa=shop@upi&pn=Taprint&am=4.00&cu=INR&tr=PB-1')
  expect(l.apps[0].href.startsWith('tez://upi/pay?')).toBe(true)
  expect(l.apps[3].href).toBe(URI)
})

test('refuses anything that is not a upi:// link', () => {
  expect(upiLinks('https://evil.example/pay')).toBeNull()
  expect(upiLinks(null)).toBeNull()
  expect(upiLinks('javascript:alert(1)')).toBeNull()
})

test('only phones and tablets can open UPI apps', () => {
  expect(canOpenUpiApps('Mozilla/5.0 (Linux; Android 14)')).toBe(true)
  expect(canOpenUpiApps('Mozilla/5.0 (iPhone; CPU iPhone OS 17)')).toBe(true)
  expect(canOpenUpiApps('Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120')).toBe(false)
})
