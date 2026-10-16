/**
 * Deep links that open a specific UPI app with the payment already filled in.
 * The amount, payee and reference come from the SERVER's payment record (payment.upi_uri); nothing here
 * decides what is owed, and opening an app proves nothing: the order is paid only once the server verifies it.
 */
const APPS = [
  { id: 'gpay', label: 'Google Pay', scheme: 'tez://upi/' },
  { id: 'phonepe', label: 'PhonePe', scheme: 'phonepe://' },
  { id: 'paytm', label: 'Paytm', scheme: 'paytmmp://' },
  { id: 'bhim', label: 'BHIM', scheme: 'upi://' },
]

/** upi://pay?x → scheme + 'pay?x' (generic upi:// opens whichever app the phone offers). */
export function upiLinks(upiUri) {
  if (typeof upiUri !== 'string' || !upiUri.startsWith('upi://')) return null
  const rest = upiUri.slice('upi://'.length)
  return {
    any: upiUri,
    apps: APPS.map((a) => ({ id: a.id, label: a.label, href: a.scheme + rest })),
  }
}

/** True on phones/tablets, where UPI apps are installed. On a desktop the deep link does nothing. */
export function canOpenUpiApps(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  return /Android|iPhone|iPad|iPod/i.test(ua)
}
