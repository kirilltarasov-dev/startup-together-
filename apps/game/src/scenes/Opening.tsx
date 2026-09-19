import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BigButton } from '../components/ui'
import { useGame } from '../state/gameStore'
import { sfx } from '../state/sfx'

const CARDS: Array<string[]> = [
  ['OBUDA, BUDAPEST', 'SEPTEMBER 19, 2026'],
  ['PUZL COWORKING', 'COGNITION × DEVIN HACKATHON'],
  ['3 FOUNDERS', '€37', '1 AI ENGINEER'],
  ['BUILD SOMETHING', 'PEOPLE WANT.'],
]

export function Opening() {
  const setScreen = useGame((s) => s.setScreen)
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i >= CARDS.length) return
    const t = setTimeout(() => setI(i + 1), i === 2 ? 2600 : 1900)
    return () => clearTimeout(t)
  }, [i])

  return (
    <div className="h-full flex items-center justify-center bg-ink relative" onClick={() => i < CARDS.length && setI(CARDS.length)}>
      <AnimatePresence mode="wait">
        {i < CARDS.length ? (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }} className="text-center space-y-3">
            {CARDS[i].map((line, j) => (
              <motion.div
                key={line}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: j * 0.35 }}
                className={`font-bold tracking-[0.25em] ${j === 0 && i !== 2 ? 'text-5xl' : 'text-3xl opacity-80'} ${i === 2 ? 'text-4xl' : ''}`}
              >
                {line}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <motion.h1
              initial={{ letterSpacing: '0.1em', opacity: 0 }}
              animate={{ letterSpacing: '0.5em', opacity: 1 }}
              transition={{ duration: 1.2 }}
              className="text-8xl font-bold"
            >
              RUNWAY
            </motion.h1>
            <p className="mt-3 opacity-60 tracking-widest text-sm">A STARTUP SURVIVAL GAME · POWERED BY DEVIN</p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-12">
              <BigButton onClick={() => { sfx('deploy'); setScreen('play') }}>START RUNWAY</BigButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-6 text-[10px] opacity-30 tracking-widest">CLICK TO SKIP</div>
    </div>
  )
}
