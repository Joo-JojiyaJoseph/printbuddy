/** Aurora background: soft colour blobs drifting slowly (decorative). */
export default function Backdrop() {
  const orb = 'pointer-events-none fixed rounded-full blur-[80px] animate-drift'
  return (
    <div aria-hidden="true">
      <div className={`${orb} -left-[12%] -top-[16%] h-[44vmax] w-[44vmax] bg-[#9fdadd] opacity-60`} />
      <div className={`${orb} -right-[10%] top-[18%] h-[36vmax] w-[36vmax] bg-[#ffd9cf] opacity-55 [animation-delay:-5s]`} />
      <div className={`${orb} -bottom-[22%] left-[18%] h-[36vmax] w-[36vmax] bg-[#bfe6e8] opacity-55 [animation-delay:-9s]`} />
      <div className={`${orb} bottom-[8%] -right-[8%] h-[24vmax] w-[24vmax] bg-[#ffe3d9] opacity-45 [animation-delay:-12s]`} />
    </div>
  )
}
