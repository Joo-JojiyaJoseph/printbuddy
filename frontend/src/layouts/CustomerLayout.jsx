import Backdrop from '../components/ui/Backdrop'
import StepProgress from '../components/ui/StepProgress'

export default function CustomerLayout({ step = 0, title, children, footer }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center sm:p-4">
      <Backdrop />
      <main className="relative z-10 flex h-dvh w-full max-w-[392px] flex-col overflow-hidden border-[var(--border)] bg-[var(--card)]/40 backdrop-blur-xl sm:h-[min(100dvh-2rem,800px)] sm:rounded-[42px] sm:border sm:shadow-[0_40px_90px_rgba(10,5,60,.5)]">
        <header className="px-4 pb-1 pt-4">
          <h2 className="m-0 text-center text-lg font-bold">{title}</h2>
          <StepProgress current={step} />
        </header>
        <section className="flex-1 overflow-y-auto px-4 pb-3 pt-2 animate-enter">{children}</section>
        {footer && <footer className="flex gap-2.5 px-4 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2.5">{footer}</footer>}
      </main>
    </div>
  )
}
