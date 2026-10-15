export default function Backdrop() {
  const orb = 'pointer-events-none fixed rounded-full blur-[60px] animate-drift'
  return (
    <div aria-hidden="true">
      <div className={`${orb} -left-[12%] -top-[14%] h-[46vmax] w-[46vmax] bg-[#6f5bff] opacity-50`} />
      <div className={`${orb} -right-[12%] top-[30%] h-[40vmax] w-[40vmax] bg-pink opacity-30 [animation-delay:-5s]`} />
      <div className={`${orb} -bottom-[25%] left-1/4 h-[38vmax] w-[38vmax] bg-[#27d9c0] opacity-30 [animation-delay:-9s]`} />
    </div>
  )
}
