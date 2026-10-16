import { CloudUpload, Lock, ReceiptText, Rocket, SlidersHorizontal, Wallet } from 'lucide-react'
import Backdrop from '../components/ui/Backdrop'
import Logo from '../components/ui/Logo'
import StepProgress from '../components/ui/StepProgress'
import HeroPanel from '../components/HeroPanel'
import CancelSession from '../components/CancelSession'

/**
 * Responsive shell.
 * Phone: header + full-width white sheet. Tablet: centred rounded card. Desktop: wide card; pages with `hero`
 * show the marketing panel on the left and the working card on the right (like the reference design).
 */
const ICONS = [Rocket, CloudUpload, SlidersHorizontal, ReceiptText, Wallet, Rocket]

export default function CustomerLayout({ step = 0, title, hint, children, footer, wide = false, hero = false }) {
  const Icon = ICONS[step] ?? Rocket
  const cardW = hero ? 'md:max-w-[45rem] lg:max-w-none' : wide ? 'md:max-w-[53.75rem] lg:max-w-[70rem]' : 'md:max-w-[45rem] lg:max-w-[47.5rem]'
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Backdrop />
      <header className="relative z-10 mx-auto flex w-full max-w-[77.5rem] items-center justify-between gap-3 px-4 py-3 md:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={42} full />
          <span className="ml-2 hidden border-l border-[var(--border)] pl-3 text-sm font-semibold text-[var(--muted)] md:inline">Tap In. Print Out.</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full glass px-3 py-1.5 text-sm font-bold text-[var(--text)] shadow-sm"><Lock size={14} aria-hidden="true" className="text-mint" /><span className="hidden sm:inline">Secure session</span><span className="sm:hidden">Secure</span></span>
          <CancelSession />
        </div>
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-[77.5rem] flex-1 px-0 pb-0 sm:px-4 sm:pb-6 md:px-8">
        <div className={`flex w-full flex-1 ${hero ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] lg:items-center lg:justify-items-center lg:gap-10 lg:rounded-[34px] lg:glass lg:p-10 lg:shadow-[var(--shadow)] lg:min-h-[calc(100dvh-8rem)]' : 'justify-center'}`}>
          {hero && <HeroPanel />}
          <main className={`flex min-h-[calc(100dvh-4rem)] w-full flex-col border-white/70 bg-white/85 backdrop-blur-xl sm:min-h-[min(calc(100dvh-7rem),40rem)] sm:rounded-[28px] sm:border sm:shadow-[var(--shadow)] ${cardW} ${hero ? 'lg:min-h-[min(calc(100dvh-15rem),40rem)] lg:max-w-[35rem] lg:justify-self-end' : ''}`}>
            <div className="rounded-t-[28px] bg-gradient-to-b from-[#e8f5f5] to-white px-4 pb-1 pt-4 md:px-8 md:pt-6">
              <StepProgress current={step} />
              {title && title !== 'Taprint' && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_8px_20px_rgba(10,74,82,.3)]"><Icon size={22} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold leading-tight md:text-xl">{title}</h2>
                    {hint && <p className="m-0 mt-0.5 text-sm text-[var(--muted)]">{hint}</p>}
                  </div>
                </div>
              )}
            </div>
            <section className="flex-1 px-4 pb-4 pt-3 animate-enter md:px-8 lg:px-10"><div className={`mx-auto w-full ${wide ? '' : 'max-w-xl'}`}>{children}</div></section>
            {footer && <footer className="sticky bottom-0 z-20 mx-auto flex w-full gap-2.5 rounded-b-[28px] border-t border-[var(--border)] bg-white/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur md:px-8 lg:justify-end lg:px-10 lg:[&>button]:max-w-[16.25rem]">{footer}</footer>}
          </main>
        </div>
      </div>
    </div>
  )
}
