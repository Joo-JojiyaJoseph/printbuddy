import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadCheckout, payWithCheckout } from './razorpay'

const info = { key_id: 'rzp_test_x', provider_order_id: 'order_1', amount_paise: 2400, currency: 'INR', name: 'Taprint', description: 'Print order PB-1' }

describe('Razorpay Checkout helper', () => {
  beforeEach(() => { delete window.Razorpay })

  it('hands the server-fixed amount and order id to the window and returns what it reports', async () => {
    let opts
    window.Razorpay = function Razorpay(o) { opts = o; this.on = vi.fn(); this.open = () => o.handler({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_9', razorpay_signature: 'sig' }) }
    const r = await payWithCheckout(info)
    expect(r).toEqual({ provider_order_id: 'order_1', provider_payment_id: 'pay_9', signature: 'sig' })
    expect(opts).toMatchObject({ key: 'rzp_test_x', order_id: 'order_1', amount: 2400, currency: 'INR' })
  })

  it('rejects with "closed" when the customer closes the window', async () => {
    window.Razorpay = function Razorpay(o) { this.on = vi.fn(); this.open = () => o.modal.ondismiss() }
    await expect(payWithCheckout(info)).rejects.toThrow('closed')
  })

  it('explains a script that cannot load, and lets the customer try again', async () => {
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((el) => { setTimeout(() => el.onerror?.(), 0); return el })
    await expect(loadCheckout()).rejects.toThrow(/internet connection/)
    await expect(loadCheckout()).rejects.toThrow(/internet connection/) // not stuck on the first failure
    expect(append).toHaveBeenCalledTimes(2)
    append.mockRestore()
  })

  it('uses the script that is already there', async () => {
    window.Razorpay = function () {}
    await expect(loadCheckout()).resolves.toBe(window.Razorpay)
  })
})
