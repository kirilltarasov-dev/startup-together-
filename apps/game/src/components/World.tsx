import { motion } from 'framer-motion'
import type { SceneId } from '../state/types'

export type Mood = 'idle' | 'alarm' | 'win' | 'lose' | 'devin'

/**
 * Scene backdrop. Uses generated art from /assets/scenes/<id>.jpg when present (see docs/ASSETS.md),
 * falling back to a gradient so the game never looks broken.
 */
const SCENES: Record<SceneId | 'devin', { img: string; fallback: string; sign: string }> = {
  S1: { img: '/assets/scenes/s1-puzl-budapest.jpg', fallback: 'from-[#2a1d16] via-[#15100d] to-[#0a0a0f]', sign: 'PUZL COWORKING · OBUDA · COGNITION × DEVIN HACKATHON' },
  S2: { img: '/assets/scenes/s2-debrecen-apartment.jpg', fallback: 'from-[#14201a] via-[#0d1410] to-[#0a0a0f]', sign: 'DEBRECEN · 2-ROOM APARTMENT' },
  S3: { img: '/assets/scenes/s3-investor-room.jpg', fallback: 'from-[#1a1d2a] via-[#0f1119] to-[#0a0a0f]', sign: 'ACCELERATOR · INVESTOR ROOM' },
  devin: { img: '/assets/scenes/devin-mission-control.jpg', fallback: 'from-[#0b1030] via-[#080a1a] to-[#0a0a0f]', sign: 'MISSION CONTROL' },
}

const TINT: Record<Mood, string> = {
  idle: 'rgba(255,179,92,0.10)',
  alarm: 'rgba(255,90,95,0.32)',
  win: 'rgba(45,212,191,0.22)',
  lose: 'rgba(20,20,28,0.55)',
  devin: 'rgba(124,156,255,0.18)',
}

export function World({ scene, mood = 'idle', shake, children }: { scene: SceneId | 'devin'; mood?: Mood; shake?: boolean; children?: React.ReactNode }) {
  const p = SCENES[scene]
  return (
    <motion.div
      key={scene}
      initial={{ opacity: 0, scale: 1.04, x: 40 }}
      animate={shake ? { opacity: 1, scale: 1, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, scale: 1, x: 0 }}
      transition={shake ? { duration: 0.5 } : { duration: 0.9, ease: 'easeOut' }}
      className={`relative flex-1 overflow-hidden bg-gradient-to-b ${p.fallback}`}
    >
      <img src={p.img} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
      <motion.div className="absolute inset-0 pointer-events-none" animate={{ background: TINT[mood] }} transition={{ duration: 0.6 }} />
      {mood === 'alarm' && <motion.div className="absolute inset-0 pointer-events-none bg-[#FF5A5F]/25" animate={{ opacity: [0.1, 0.5, 0.1] }} transition={{ repeat: Infinity, duration: 1 }} />}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent pointer-events-none" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase opacity-50">{p.sign}</div>
      <div className="relative h-full flex flex-col items-center justify-end pb-6 gap-6 px-6">{children}</div>
    </motion.div>
  )
}
