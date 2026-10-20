import { useState } from 'react'
import Logo from '../../components/ui/Logo'
import { IS_MOCK } from '../../services/api'
import { Btn, Field, Notice, inputCls } from '../ui'

export default function Login({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try { await onSignIn(email.trim(), password) } catch (x) { setErr(x.message || 'Could not sign in') } finally { setBusy(false) }
  }
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(50rem_30rem_at_85%_-10%,#d9ceff_0,transparent_60%),radial-gradient(40rem_30rem_at_0%_100%,#ffd5e2_0,transparent_60%),#f6f3ff] p-4">
      <div aria-hidden="true" className="orb3d pointer-events-none absolute -left-8 top-[18%] hidden size-28 animate-bob rounded-full opacity-80 md:block" />
      <div aria-hidden="true" className="pill3d pointer-events-none absolute bottom-[14%] right-[8%] hidden h-9 w-28 animate-[tilt-float_6s_ease-in-out_infinite] rounded-full [--r:-24deg] md:block" />
      <form onSubmit={submit} className="clay animate-card-in relative w-full max-w-sm rounded-[28px] p-7">
        <Logo size={38} full />
        <h1 className="m-0 mt-5 text-xl font-bold">Admin sign in</h1>
        <p className="m-0 mt-1 text-sm text-[var(--muted)]">Staff only.</p>
        <div className="mt-4 grid gap-3">
          <Field label="E-mail"><input className={inputCls} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {err && <Notice tone="bad">{err}</Notice>}
          <Btn variant="solid" type="submit" loading={busy} className="min-h-10">Sign in</Btn>
        </div>
        {IS_MOCK && <p className="m-0 mt-4 rounded-lg bg-[var(--hi)] p-2.5 text-xs text-[var(--muted)]">Demo mode (no server): <b>admin@taprint.test</b> / <b>demo-password</b></p>}
      </form>
    </div>
  )
}
