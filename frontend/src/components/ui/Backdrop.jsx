import { useEffect, useRef } from 'react'

/**
 * The page background: a soft lavender glow with a few floating 3D objects (glass ball, tile, paper, pink pill).
 * They bob slowly and drift a little towards the pointer. Decorative only; still when the device asks for less motion.
 */
export default function Backdrop() {
  const root = useRef(null)
  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return undefined
    let raf = 0
    const move = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--px', ((e.clientX / window.innerWidth) - 0.5).toFixed(3))
        el.style.setProperty('--py', ((e.clientY / window.innerHeight) - 0.5).toFixed(3))
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [])

  const orb = 'pointer-events-none fixed rounded-full blur-[56px] md:blur-[90px] animate-drift'
  // each object: where it sits, how far the pointer moves it (depth) and when it starts bobbing
  const obj = 'pointer-events-none fixed transition-transform duration-300 ease-out will-change-transform'
  const move = (k) => ({ transform: `translate(calc(var(--px,0) * ${k}px), calc(var(--py,0) * ${k}px))` })
  return (
    <div ref={root} aria-hidden="true">
      <div className={`${orb} -left-[12%] -top-[16%] h-[46vmax] w-[46vmax] bg-[#cdbfff] opacity-70`} />
      <div className={`${orb} -right-[10%] top-[16%] h-[38vmax] w-[38vmax] bg-[#ffd5e2] opacity-60 [animation-delay:-5s]`} />
      <div className={`${orb} -bottom-[22%] left-[18%] h-[38vmax] w-[38vmax] bg-[#d9ceff] opacity-60 [animation-delay:-9s]`} />

      <div className={`${obj} -left-5 top-[44%] hidden md:block`} style={move(-34)}>
        <div className="orb3d size-20 animate-bob rounded-full opacity-80 lg:size-24" />
      </div>
      <div className={`${obj} bottom-[4%] left-[1%] hidden 2xl:block`} style={move(26)}>
        <div className="cube3d size-20 rounded-[1.5rem] [--r:-14deg] [animation:tilt-float_7s_ease-in-out_infinite]" />
      </div>
      <div className={`${obj} -right-4 top-[10%] hidden xl:block`} style={move(40)}>
        <div className="sheet3d grid h-28 w-20 place-content-center gap-2 rounded-xl p-3 [--r:10deg] [animation:tilt-float_8s_ease-in-out_-2s_infinite]">
          <i className="block h-1.5 w-12 rounded-full bg-[#cdbfff]" /><i className="block h-1.5 w-9 rounded-full bg-[#e0d8fb]" /><i className="block h-1.5 w-11 rounded-full bg-[#e0d8fb]" /><i className="block h-1.5 w-7 rounded-full bg-[#ffd5e2]" />
        </div>
      </div>
      <div className={`${obj} bottom-[16%] right-[5%] hidden lg:block`} style={move(-22)}>
        <div className="pill3d h-9 w-28 rounded-full [--r:-24deg] [animation:tilt-float_6s_ease-in-out_-1s_infinite]" />
      </div>
      <div className={`${obj} -right-4 top-[46%] md:hidden`}><div className="orb3d size-16 animate-bob rounded-full opacity-90" /></div>
    </div>
  )
}
