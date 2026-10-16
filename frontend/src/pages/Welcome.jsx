import { useNavigate } from 'react-router-dom'
import { CloudUpload, SlidersHorizontal, Timer, Wallet, Printer } from 'lucide-react'
import CustomerLayout from '../layouts/CustomerLayout'
import Button from '../components/ui/Button'
import { useSession } from '../context/SessionContext'
import { useCountdown, mmss } from '../hooks/useCountdown'

const STEPS = [
  { icon: CloudUpload, title: 'Add your files', text: 'Choose from your phone or scan a page', tint: 'from-[#0E7C86] to-[#0A4A52]' },
  { icon: SlidersHorizontal, title: 'Pick your options', text: 'Colour, paper, sides. The price updates live', tint: 'from-[#10242B] to-[#0E7C86]' },
  { icon: Wallet, title: 'Pay with UPI', text: 'Any UPI app. Confirmed by our server', tint: 'from-[#12a679] to-[#36d6a0]' },
  { icon: Printer, title: 'Collect your prints', text: 'Printing starts as soon as payment is verified', tint: 'from-[#FF6B4A] to-[#FF9A6B]' },
]

export default function Welcome() {
  const { token, session } = useSession()
  const navigate = useNavigate()
  const left = useCountdown(session.expires_at)
  return (
    <CustomerLayout hero step={0} title="Taprint"
      footer={<Button onClick={() => navigate(`/s/${token}/upload`)}>Get started</Button>}>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcf6ec] px-3 py-1 text-sm font-bold text-[#0b7a57]"><i className="size-2 rounded-full bg-mint" />Connected to {session.kiosk.name}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--hi)] px-3 py-1 text-sm font-bold text-[var(--muted)]"><Timer size={14} aria-hidden="true" />{mmss(left)} left</span>
      </div>
      <h1 className="mb-1 mt-4 text-[24px] font-bold leading-[1.15] tracking-tight lg:text-[22px]"><span className="lg:hidden">Print anything,<br />in seconds.</span><span className="hidden lg:inline">Let's get printing</span></h1>
      <p className="mb-4 mt-1 text-[15px] text-[var(--muted)]">It takes four quick steps. No app to install.</p>
      <ol className="stagger relative m-0 grid list-none gap-3 p-0">
        {STEPS.map(({ icon: Icon, title, text, tint }, i) => (
          <li key={title} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 shadow-[0_4px_14px_rgba(10,74,82,.06)] transition-transform hover:-translate-y-0.5">
            <span className={`grid size-11 flex-none place-items-center rounded-2xl bg-gradient-to-br text-white ${tint}`}><Icon size={22} aria-hidden="true" /></span>
            <span className="min-w-0"><b className="block text-[15px]">{i + 1}. {title}</b><span className="text-[13px] text-[var(--muted)]">{text}</span></span>
          </li>
        ))}
      </ol>
    </CustomerLayout>
  )
}
