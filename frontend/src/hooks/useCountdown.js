import { useEffect, useState } from 'react'

export function useCountdown(expiresAt) {
  const calc = () => Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
  const [left, setLeft] = useState(expiresAt ? calc : 0)
  useEffect(() => {
    if (!expiresAt) return
    setLeft(calc())
    const t = setInterval(() => setLeft(calc()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])
  return left
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
