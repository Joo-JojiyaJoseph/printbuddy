import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, CreditCard, History, LayoutDashboard, LogOut, Menu, Monitor, Printer, Settings, Tag, Users, X, QrCode, Wallet } from 'lucide-react'
import Logo from '../components/ui/Logo'
import { adminApi, tokenStore } from './adminApi'
import { Loading } from './ui'
import Login from './pages/Login'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const Payments = lazy(() => import('./pages/Payments'))
const Sessions = lazy(() => import('./pages/Sessions'))
const Devices = lazy(() => import('./pages/Devices'))
const Reports = lazy(() => import('./pages/Reports'))
const PaymentGateway = lazy(() => import('./pages/PaymentGateway'))
const Pricing = lazy(() => import('./pages/Pricing'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const Activity = lazy(() => import('./pages/Activity'))

const AdminCtx = createContext(null)
export const useAdmin = () => useContext(AdminCtx)

const NAV = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'orders', label: 'Orders', icon: ClipboardList },
  { to: 'payments', label: 'Payments', icon: CreditCard },
  { to: 'sessions', label: 'QR sessions', icon: QrCode },
  { to: 'devices', label: 'Printer & kiosks', icon: Printer },
  { to: 'reports', label: 'Reports', icon: BarChart3 },
  { to: 'payment', label: 'Payment gateway', icon: Wallet, admin: true },
  { to: 'pricing', label: 'Pricing', icon: Tag },
  { to: 'settings', label: 'Settings', icon: Settings },
  { to: 'users', label: 'Staff', icon: Users, admin: true },
  { to: 'activity', label: 'Activity log', icon: History },
]

function Shell({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const links = NAV.filter((n) => !n.admin || user.role === 'admin')
  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={`/admin/${to}`} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition ${isActive ? 'bg-[var(--color-accent-2)] text-white' : 'text-[var(--text)] hover:bg-[var(--hi)]'}`}>
          <Icon size={17} aria-hidden="true" />{label}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <div className="min-h-dvh bg-[#f6f3ff] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-white p-4 lg:flex">
        <Logo size={34} full />
        {nav}
        <div className="mt-auto rounded-xl bg-[var(--hi)] p-3 text-xs">
          <p className="m-0 font-semibold [overflow-wrap:anywhere]">{user.name}</p>
          <p className="m-0 capitalize text-[var(--muted)]">{user.role}</p>
          <button type="button" onClick={onLogout} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent-2)]"><LogOut size={14} aria-hidden="true" />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Logo size={30} full />
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-[var(--hi)]"><Menu size={20} /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[#1f1b3d]/45" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-[min(18rem,85vw)] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between"><span className="text-sm font-bold">{user.name}</span><button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--hi)]"><X size={18} /></button></div>
              {nav}
              <button type="button" onClick={onLogout} className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent-2)]"><LogOut size={15} aria-hidden="true" />Sign out</button>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="devices" element={<Devices />} />
              <Route path="reports" element={<Reports />} />
              <Route path="payment" element={user.role === 'admin' ? <PaymentGateway /> : <Navigate to="/admin" replace />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="users" element={user.role === 'admin' ? <UsersPage /> : <Navigate to="/admin" replace />} />
              <Route path="activity" element={<Activity />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}

/** /admin/* — sign-in gate, then the panel. The token lives in sessionStorage (cleared when the tab closes). */
export default function AdminApp() {
  const [user, setUser] = useState(undefined) // undefined = checking
  const navigate = useNavigate()
  useEffect(() => { document.documentElement.classList.add('is-admin'); return () => document.documentElement.classList.remove('is-admin') }, [])
  useEffect(() => {
    if (!tokenStore.get()) { setUser(null); return }
    adminApi.me().then(setUser).catch(() => { tokenStore.set(null); setUser(null) })
  }, [])
  const signIn = useCallback(async (email, password) => {
    const r = await adminApi.login(email, password)
    tokenStore.set(r.token)
    setUser(r.user)
  }, [])
  const signOut = useCallback(async () => { await adminApi.logout(); tokenStore.set(null); setUser(null); navigate('/admin') }, [navigate])

  if (user === undefined) return <Loading />
  if (!user) return <Login onSignIn={signIn} />
  return (
    <AdminCtx.Provider value={{ user, canOperate: user.role !== 'viewer', isAdmin: user.role === 'admin' }}>
      <Shell user={user} onLogout={signOut} />
    </AdminCtx.Provider>
  )
}
