// Razorpay's own payment window (cards, netbanking, wallets, UPI). Its script is fetched from Razorpay only when the
// customer asks for it. The window only ever pays the amount the SERVER fixed on the Razorpay order; what it returns
// is sent to our server, which asks Razorpay whether the money really arrived.
const SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading

export function loadCheckout() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser.'))
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('x')))
    s.onerror = () => reject(new Error('x'))
    document.head.appendChild(s)
  }).catch(() => {
    loading = undefined // let the customer try again
    throw new Error('Could not open the card payment window. Check your internet connection and try again.')
  })
  return loading
}

/**
 * Opens the window for a server-made checkout order.
 * @param {{key_id:string, provider_order_id:string, amount_paise:number, currency:string, name:string, description:string}} c
 * @returns {Promise<{provider_order_id:string, provider_payment_id:string, signature:string}>}
 *   rejects with Error('closed') when the customer closes the window, or an Error with Razorpay's message when a payment fails.
 */
export async function payWithCheckout(c) {
  const Razorpay = await loadCheckout()
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: c.key_id,
      order_id: c.provider_order_id,
      amount: c.amount_paise,
      currency: c.currency,
      name: c.name,
      description: c.description,
      theme: { color: '#6a4be0' },
      handler: (r) => resolve({ provider_order_id: r.razorpay_order_id, provider_payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: { ondismiss: () => reject(new Error('closed')) },
    })
    rzp.on?.('payment.failed', (e) => { /* the window stays open so they can retry another method */ void e })
    rzp.open()
  })
}
