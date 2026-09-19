import { animate, motion, useMotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  format?: (n: number) => string
  className?: string
  duration?: number
}

export const fmtInt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '∞')
export const fmtEur = (n: number) => `€${fmtInt(n)}`
export const fmtCompactEur = (n: number) =>
  n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `€${Math.round(n / 1000)}k` : fmtEur(n)

export function AnimatedNumber({ value, format = fmtInt, className, duration = 0.8 }: Props) {
  const mv = useMotionValue(value)
  const [display, setDisplay] = useState(format(value))
  const prev = useRef(value)
  const [delta, setDelta] = useState<number | null>(null)

  useEffect(() => {
    const d = value - prev.current
    prev.current = value
    if (d !== 0 && Number.isFinite(d)) {
      setDelta(d)
      const id = setTimeout(() => setDelta(null), 1400)
      const ctrl = animate(mv, value, { duration, ease: 'easeOut', onUpdate: (v) => setDisplay(format(v)) })
      return () => { clearTimeout(id); ctrl.stop() }
    }
    setDisplay(format(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`relative inline-block tabular-nums ${className ?? ''}`}>
      {display}
      {delta !== null && (
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [0, 1, 1, 0], y: -14 }}
          transition={{ duration: 1.3 }}
          className={`absolute -top-3 right-0 text-xs font-bold mono ${delta > 0 ? 'text-mint' : 'text-blood'}`}
        >
          {delta > 0 ? '+' : ''}{format(delta)}
        </motion.span>
      )}
    </span>
  )
}
