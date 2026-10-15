import { useNavigate } from 'react-router-dom'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import { useSession } from '../context/SessionContext'
import { useCountdown, mmss } from '../hooks/useCountdown'

export default function Welcome() {
  const { token, session } = useSession()
  const navigate = useNavigate()
  const left = useCountdown(session.expires_at)
  return (
    <CustomerLayout step={0} title="PrintBuddy"
      footer={<Button onClick={() => navigate(`/s/${token}/upload`)}>Get started</Button>}>
      <span className="mt-4 inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-bold text-accent">● Connected · {session.kiosk.name}</span>
      <h1 className="mb-1.5 mt-3 text-[32px] font-extrabold leading-[1.1] tracking-tight">Print anything,<br />in seconds.</h1>
      <p className="text-[15px] text-[var(--muted)]">Upload, fix your pages, pay with UPI and collect. No app to install.</p>
      <p className="text-sm text-[var(--muted)]">Session time left: <b>{mmss(left)}</b></p>
    </CustomerLayout>
  )
}
