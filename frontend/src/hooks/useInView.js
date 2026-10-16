import { useEffect, useRef, useState } from 'react'

/** True once the element has come near the viewport (always true where IntersectionObserver is missing). */
export function useInView(rootMargin = '200px') {
  const ref = useRef(null)
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (seen || !ref.current) return undefined
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { rootMargin })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen, rootMargin])
  return [ref, seen]
}
