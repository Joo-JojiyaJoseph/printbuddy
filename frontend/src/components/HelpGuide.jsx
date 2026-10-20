import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react'
import Modal from './ui/Modal'

const BASE = import.meta.env.BASE_URL || '/'

/** The how-to: one picture (a real screen from the app) and a few plain words per step. */
const STEPS = [
  { img: 'scan', wide: true, title: 'Scan the code', text: 'Open your phone camera and point it at the QR code on the printer screen. You do not need to install anything.', tip: 'The code changes every few minutes. If it has expired, the screen shows a fresh one.' },
  { img: 'start', title: 'Tap “Get started”', text: 'Your phone opens a page that is linked to this printer. Tap the big button at the bottom to begin.' },
  { img: 'files', title: 'Add your file', text: 'Tap “Add files”, “Photos” or “Scan”. You can print PDFs, photos, Word, Excel and PowerPoint files. Add more than one if you like, then tap “Continue”.', tip: 'Old Word, Excel or PowerPoint files (.doc, .xls, .ppt) must be saved as a newer file or a PDF first.' },
  { img: 'options', title: 'Choose how to print', text: 'Pick the pages, number of copies, colour or black and white, paper size and one or both sides. The price changes while you choose, so there are no surprises.' },
  { img: 'review', title: 'Check your order', text: 'Look at the list once more. If something is wrong, tap “Edit”. If it is right, tap the pink “Pay” button.' },
  { img: 'pay', title: 'Pay', text: 'Pay with any UPI app (Google Pay, PhonePe, Paytm, BHIM), or choose card, netbanking or wallet. Stay on this page until it says your payment was received.', tip: 'Never pay twice. If you are not sure it worked, wait a minute. The page updates by itself.' },
  { img: 'done', title: 'Collect your pages', text: 'When you see “Payment successful”, your pages start printing. Take them from the printer tray. Your files are deleted afterwards.' },
]

const FAQ = [
  ['Which files can I print?', 'PDFs, photos (JPG, PNG), and Word, Excel and PowerPoint files. Text files work too.'],
  ['I paid but nothing came out.', 'Do not pay again. Note your order number (it starts with PB-) and show it to the person looking after the printer. They can send it to the printer again, and you are not charged twice.'],
  ['I picked the wrong file or want to stop.', 'Tap “Exit” at the top of the page. Your files are deleted and the printer is free for the next person. If you have already paid, your print still goes ahead.'],
  ['Is my file private?', 'Yes. Only you can see it, and it is deleted from our system soon after printing or when you leave.'],
  ['The page says someone else is using the printer.', 'Another person is in the middle of printing. Wait a minute, then scan the new code on the printer screen.'],
]

function Faq() {
  const [open, setOpen] = useState(null)
  return (
    <div className="mt-6">
      <h3 className="m-0 mb-2 text-base font-extrabold">Common questions</h3>
      <div className="grid gap-2">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_4px_12px_-6px_rgba(74,50,184,.2)]">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left text-[0.9375rem] font-bold">
              {q}<ChevronDown size={18} aria-hidden="true" className={`flex-none text-accent-2 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="m-0 animate-rise px-4 pb-3 text-sm leading-relaxed text-[var(--muted)]">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Guide() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const last = i === STEPS.length - 1
  return (
    <div className="mt-3">
      <ol className="m-0 mb-4 flex list-none items-center gap-1.5 p-0" aria-label="Steps">
        {STEPS.map((x, n) => (
          <li key={x.img} className="flex-1">
            <button type="button" onClick={() => setI(n)} aria-label={`Step ${n + 1}: ${x.title}`} aria-current={n === i ? 'step' : undefined}
              className={`h-2.5 w-full rounded-full transition-all duration-300 ${n === i ? 'bg-gradient-to-r from-[#9a80ff] to-[#6246e6] shadow-[0_0_10px_rgba(124,92,252,.6)]' : n < i ? 'bg-mint' : 'bg-[#e4dcfb] hover:bg-[#cdbfff]'}`} />
          </li>
        ))}
      </ol>

      <div key={s.img} className="grid animate-pop items-center gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[15rem] [perspective:900px]">
          <div className={`overflow-hidden bg-white shadow-[0_0_0_6px_#1f1b3d,0_0_0_8px_#4a3f8f,0_26px_40px_-14px_rgba(74,50,184,.55)] transition-transform duration-500 hover:[transform:rotateY(-6deg)_rotateX(3deg)] ${s.wide ? 'rounded-2xl' : 'rounded-[1.75rem]'}`}>
            <img src={`${BASE}help/${s.img}.webp`} alt={`Screenshot: ${s.title}`} width={s.wide ? 620 : 390} height={s.wide ? 620 : 780} loading="lazy" decoding="async" className="block h-auto w-full" />
          </div>
        </div>
        <div className="min-w-0">
          <span className="tile3d mb-2 grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#9a80ff] to-[#5a3fd0] text-lg font-extrabold text-white">{i + 1}</span>
          <h3 className="m-0 text-xl font-extrabold leading-tight tracking-tight">{s.title}</h3>
          <p className="m-0 mt-2 text-base leading-relaxed text-[var(--muted)]">{s.text}</p>
          {s.tip && <p className="m-0 mt-3 rounded-2xl bg-[#fff4d8] px-3.5 py-2.5 text-sm leading-relaxed text-[#7a4a00] shadow-[inset_0_1px_0_rgba(255,255,255,.8)]"><b>Tip:</b> {s.tip}</p>}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="b3d inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d6cdf3] bg-gradient-to-b from-white to-[#f1ecff] font-bold [--edge:#c2b6ec] disabled:opacity-40"><ChevronLeft size={18} aria-hidden="true" />Back</button>
        <button type="button" onClick={() => (last ? setI(0) : setI(i + 1))} className="cta b3d inline-flex min-h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-[#9a80ff] via-[#7c5cfc] to-[#6a4be0] font-bold text-white">{last ? 'Start again' : 'Next'}{!last && <ChevronRight size={18} aria-hidden="true" />}</button>
      </div>
      <Faq />
    </div>
  )
}

/** "Help" in the header (or floating on the printer screen). Opens the step-by-step guide on top of whatever the person is doing. */
export default function HelpButton({ floating = false }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className={floating ? 'fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6' : 'contents'}>
        <button type="button" onClick={() => setOpen(true)} aria-label="Help: how to print"
          className={floating
            ? 'cta b3d inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-b from-[#9a80ff] via-[#7c5cfc] to-[#6a4be0] px-5 font-bold text-white'
            : 'inline-flex min-h-10 items-center gap-1.5 rounded-full glass px-3 text-sm font-bold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white'}>
          <CircleHelp size={floating ? 20 : 17} aria-hidden="true" className={floating ? '' : 'text-accent-2'} />Help
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="How to print with Taprint" size="xl">
        <p className="m-0 mt-1 text-sm text-[var(--muted)]">Seven easy steps. It takes about two minutes.</p>
        {open && <Guide />}
      </Modal>
    </>
  )
}
