import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminApp from './AdminApp'
import { adminApi, resetDemo, salesFrom, tokenStore } from './adminApi'

const app = (path = '/admin') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminApp />} /></Routes></MemoryRouter>)
const signIn = async (email = 'admin@taprint.test', pw = 'demo-password') => {
  fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: pw } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => { tokenStore.set(null); resetDemo() })

describe('admin sign in', () => {
  it('shows the sign-in form when there is no token', async () => {
    app()
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeTruthy()
  })
  it('rejects wrong credentials with a message', async () => {
    app(); await signIn('admin@taprint.test', 'nope')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(tokenStore.get()).toBeNull()
  })
  it('opens the dashboard after a good sign in', async () => {
    app(); await signIn()
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 8000 })).toBeTruthy()
    expect(tokenStore.get()).toBeTruthy()
  })
  it('lists every module in the menu for an admin', async () => {
    app(); await signIn()
    await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 8000 })
    for (const n of ['Orders', 'Payments', 'QR sessions', 'Printer & kiosks', 'Reports', 'Pricing', 'Settings', 'Staff', 'Activity log']) {
      expect(screen.getAllByRole('link', { name: n }).length).toBeGreaterThan(0)
    }
  })
})

describe('demo data and rules', () => {
  it('sales report fills every day and adds up', async () => {
    const orders = [
      { status: 'paid', paid_at: '2026-10-14T10:00:00', total_paise: 2400, pages: 6, copies: 2, paper: 'A4', color: 'bw', kiosk: 'demo' },
      { status: 'paid', paid_at: '2026-10-16T10:00:00', total_paise: 800, pages: 1, copies: 1, paper: 'A5', color: 'color', kiosk: 'k2' },
      { status: 'cancelled', paid_at: null, total_paise: 999, pages: 1, copies: 1, paper: 'A4', color: 'bw', kiosk: 'demo' },
    ]
    const r = salesFrom(orders, '2026-10-13', '2026-10-16')
    expect(r.daily).toHaveLength(4)
    expect(r.totals).toEqual({ orders: 2, revenue_paise: 3200, billable_sides: 13, average_order_paise: 1600 })
    expect(r.by_paper[0].key).toBe('A4')
  })
  it('refuses an unsafe printer name', async () => {
    await expect(adminApi.selectPrinter('-o evil')).rejects.toThrow()
    const ok = await adminApi.selectPrinter('HP LaserJet Pro M404')
    expect(ok.printer).toBe('HP LaserJet Pro M404')
  })
  it('retry is only allowed for a failed print, and cancel only for unpaid orders', async () => {
    await expect(adminApi.retryPrint('TP-04800')).rejects.toThrow()
    await expect(adminApi.cancelOrder('TP-04800')).rejects.toThrow()
    const failed = (await adminApi.orders({ per_page: 100 })).data.find((o) => o.print_status === 'failed')
    expect((await adminApi.retryPrint(failed.reference)).print_status).toBe('sent')
  })
  it('keeps at least one admin', async () => {
    await expect(adminApi.updateUser(1, { role: 'viewer' })).rejects.toThrow('at least one admin')
    await expect(adminApi.deleteUser(1)).rejects.toThrow()
  })
})

describe('printer screen', () => {
  it('shows the development-driver warning and test button', async () => {
    app('/admin/devices'); await signIn()
    expect(await screen.findByText(/saving PDFs to a folder instead of printing/, {}, { timeout: 8000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Print test page' }))
    await waitFor(() => expect(screen.getByText(/nothing was printed/)).toBeTruthy())
  })
})

describe('printing from each shop PC', () => {
  it('agent mode hides server printer checks; each kiosk gets its own key, shown once', async () => {
    await adminApi.saveIntegrations({ print_driver: 'agent' })
    app('/admin/devices'); await signIn()
    expect(await screen.findByText(/Printing on each shop/, {}, { timeout: 8000 })).toBeTruthy()
    expect(screen.getByText(/No shop PC print program is connected/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Print test page' })).toBeNull()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Print key' }))[0])
    const key = await screen.findByTestId('agent-key')
    expect(key.textContent).toMatch(/^tpa_/)
    expect(screen.getByText(/shown only once/)).toBeTruthy()
  })
})

describe('payment gateway and printer settings', () => {
  it('Razorpay cannot be chosen until all three keys are saved', async () => {
    await expect(adminApi.saveIntegrations({ payment_provider: 'razorpay' })).rejects.toThrow(/Razorpay Key ID, Razorpay Key Secret\./)
    await adminApi.saveIntegrations({ razorpay_key_id: 'rzp_test_abc12345', razorpay_key_secret: 'secret-value-1', razorpay_webhook_secret: 'a-long-random-string-123' })
    const r = await adminApi.saveIntegrations({ payment_provider: 'razorpay' })
    expect(r.payment.provider).toBe('razorpay')
  })
  it('secrets are never sent back, only whether they are set', async () => {
    await adminApi.saveIntegrations({ razorpay_key_id: 'rzp_test_abc12345', razorpay_key_secret: 'secret-value-1', razorpay_webhook_secret: 'a-long-random-string-123' })
    const r = await adminApi.integrations()
    expect(r.payment.key_secret_set).toBe(true)
    expect(JSON.stringify(r)).not.toContain('secret-value-1')
    expect(JSON.stringify(r)).not.toContain('a-long-random-string-123')
  })
  it('refuses a malformed key id, a short webhook secret and the wrong program', async () => {
    await expect(adminApi.saveIntegrations({ razorpay_key_id: 'nope' })).rejects.toThrow(/rzp_test_/)
    await expect(adminApi.saveIntegrations({ razorpay_webhook_secret: 'short' })).rejects.toThrow(/16 characters/)
    await expect(adminApi.saveIntegrations({ lp_path: '/bin/sh' })).rejects.toThrow(/named lp/)
    await expect(adminApi.saveIntegrations({ lp_path: 'lp' })).rejects.toThrow(/full path/)
    await adminApi.saveIntegrations({ sumatra_path: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe' })
  })
  it('connection test needs a saved Razorpay setup', async () => {
    await expect(adminApi.testPayment()).rejects.toThrow(/not the selected/)
  })
  it('the gateway screen saves keys and then shows them as saved', async () => {
    app('/admin/payment'); await signIn()
    const select = await screen.findByLabelText('Payment provider', {}, { timeout: 8000 })
    fireEvent.change(select, { target: { value: 'razorpay' } })
    fireEvent.change(screen.getByLabelText('Key ID', { exact: false }), { target: { value: 'rzp_test_abc12345' } })
    fireEvent.change(screen.getByLabelText(/^Key Secret/), { target: { value: 'secret-value-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate a random webhook secret' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0])
    expect(await screen.findByText(/Saved\. The secrets are stored encrypted/)).toBeTruthy()
    await waitFor(() => expect(screen.getAllByPlaceholderText('•••••••• saved')).toHaveLength(2)) // key secret and webhook secret both show as saved, never their values
  })
})
