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
const Kiosks = lazy(() => import('./pages/Kiosks'))

const AdminCtx = createContext(null)
export const useAdmin = () => useContext(AdminCtx)

const NAV = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'orders', label: 'Orders', icon: ClipboardList },
  { to: 'payments', label: 'Payments', icon: CreditCard },
  { to: 'sessions', label: 'QR sessions', icon: QrCode },
  { to: 'kiosks', label: 'Kiosks', icon: Monitor },
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
    <nav aria-label="Admin" className="flex flex-col gap-1.5">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={`/admin/${to}`} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `group flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold transition duration-200 ${isActive ? 'bg-gradient-to-r from-[#7c5cfc] to-[#5a3fd0] text-white shadow-[0_8px_18px_-6px_rgba(124,92,252,.7),inset_0_1px_0_rgba(255,255,255,.3)]' : 'text-[#cfc7f5] hover:translate-x-0.5 hover:bg-white/10 hover:text-white'}`}>
          {({ isActive }) => (<>
            <span className={`grid size-8 flex-none place-items-center rounded-lg transition ${isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/15'}`}><Icon size={17} aria-hidden="true" /></span>{label}
          </>)}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <div className="min-h-dvh bg-[radial-gradient(60rem_30rem_at_90%_-10%,#e6dfff_0,transparent_60%),radial-gradient(40rem_30rem_at_0%_100%,#ffe3ec_0,transparent_60%),#f6f3ff] lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 overflow-y-auto bg-gradient-to-b from-[#241a6b] via-[#1d1450] to-[#150e3a] p-4 shadow-[8px_0_30px_-12px_rgba(21,14,58,.6)] lg:flex">
        <div className="rounded-2xl bg-white px-3 py-2.5 shadow-[0_8px_18px_-8px_rgba(0,0,0,.5)]"><Logo size={32} full /></div>
        {nav}
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-xs text-white ring-1 ring-white/10">
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-gradient-to-br from-[#ff9fbb] to-[#7c5cfc] text-base font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,.4)]" aria-hidden="true">{(user.name || '?').trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-bold">{user.name}</p>
            <p className="m-0 capitalize text-[#b9aef0]">{user.role}</p>
          </div>
          <button type="button" onClick={onLogout} aria-label="Sign out" title="Sign out" className="grid size-9 flex-none place-items-center rounded-lg text-[#e7e1ff] transition hover:bg-white/15 hover:text-white"><LogOut size={17} aria-hidden="true" /></button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/60 bg-white/85 px-4 py-2.5 shadow-[0_6px_18px_-10px_rgba(74,50,184,.35)] backdrop-blur-xl lg:hidden">
          <Logo size={30} full />
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg hover:bg-[var(--hi)]"><Menu size={20} /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-[#1f1b3d]/45" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-[min(18rem,85vw)] flex-col gap-4 overflow-y-auto bg-gradient-to-b from-[#241a6b] to-[#150e3a] p-4 text-white shadow-2xl">
              <div className="flex items-center justify-between"><span className="text-sm font-bold">{user.name}</span><button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-white/15"><X size={18} /></button></div>
              {nav}
              <button type="button" onClick={onLogout} className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[#e7e1ff]"><LogOut size={15} aria-hidden="true" />Sign out</button>
            </div>
          </div>
        )}
        <main className="animate-rise mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="payments" element={<Payments />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="kiosks" element={<Kiosks />} />
              <Route path="kiosks/:code" element={<Kiosks />} />
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
