import { motion } from 'framer-motion'
import { useState } from 'react'
import { useGame } from '../state/gameStore'
import type { Founder, FounderId } from '../state/types'

export type FounderMood = 'idle' | 'alarm' | 'win' | 'lose'

/**
 * Founder figure. Uses generated character art from /assets/founders/<id>.png (transparent, full body, see docs/ASSETS.md).
 * Falls back to a flat colored silhouette until the art lands.
 */
export function FounderFigure({ f, active, mood = 'idle' }: { f: Founder; active?: boolean; mood?: FounderMood }) {
  const [imgOk, setImgOk] = useState(true)
  const anim =
    mood === 'alarm' ? { y: [0, -6, 0], transition: { repeat: Infinity, duration: 0.5 } }
    : mood === 'win' ? { y: [0, -28, 0], transition: { duration: 1.2 } }
    : mood === 'lose' ? { rotate: 8, y: 10, transition: { duration: 1 } }
    : { y: [0, -3, 0], transition: { repeat: Infinity, duration: 2.4 + (f.id === 'sadman' ? 0.4 : 0) } }
  const h = f.id === 'kirill' ? 300 : f.id === 'sadman' ? 250 : 280

  return (
    <motion.div layout animate={{ scale: active ? 1.08 : 1, filter: active ? 'brightness(1.15)' : 'brightness(0.9)' }} className="relative flex flex-col items-center">
      <motion.div animate={anim} className="relative" style={{ height: h }}>
        {imgOk ? (
          <img src={`/assets/founders/${f.id}.png`} alt={f.name} onError={() => setImgOk(false)} className="h-full w-auto drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]" draggable={false} />
        ) : (
          <div className="h-full flex flex-col items-center">
            <div className="w-14 h-14 rounded-full" style={{ background: f.color }} />
            <div className="flex-1 rounded-t-[28px] rounded-b-xl -mt-1" style={{ width: f.id === 'sadman' ? 84 : 66, background: f.color }} />
          </div>
        )}
        {active && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-4 w-4 h-4 rounded-full bg-gold shadow-[0_0_20px_var(--color-gold)]" />
        )}
      </motion.div>
      <div className="mt-2 text-center">
        <div className="font-bold text-lg leading-tight" style={{ color: f.color }}>{f.name}</div>
        <div className="text-[10px] tracking-widest uppercase opacity-60">{f.role}</div>
      </div>
    </motion.div>
  )
}

export function Founders({ active, mood }: { active?: FounderId; mood?: FounderMood }) {
  const founders = useGame((s) => s.founders)
  return (
    <div className="flex gap-16 justify-center items-end">
      {(['sadman', 'kirill', 'sergio'] as FounderId[]).map((id) => <FounderFigure key={id} f={founders[id]} active={active === id} mood={mood} />)}
    </div>
  )
}
