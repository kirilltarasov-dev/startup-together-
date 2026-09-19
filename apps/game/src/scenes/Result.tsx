import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BigButton } from '../components/ui'
import { World } from '../components/World'
import { RESULT_LINE } from '../events/skit'
import { FOUNDERS, useGame } from '../state/gameStore'
import { sfx } from '../state/sfx'

/** Hackathon result interstitial (docs/SKIT.md). One click. */
export function Result() {
  const g = useGame()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (step === 2) { g.apply({ users: 1 }); sfx('chime') }
    if (step >= 3) return
    const t = setTimeout(() => setStep(step + 1), step === 0 ? 1400 : 1600)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = () => { g.goScene('S2'); g.nextEvent(); g.setScreen('play') }

  return (
    <World scene="S1" mood="lose">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
        <AnimatePresence>
          {step >= 1 && <motion.div key="a" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-7xl font-bold tracking-widest">You didn't win.</motion.div>}
          {step >= 2 && (
            <motion.div key="b" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-2xl opacity-80">Unfortunately, somebody signed up.</div>
              <div className="mono text-5xl font-bold text-mint mt-3">USERS +1</div>
            </motion.div>
          )}
          {step >= 3 && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6">
              <div className="flex gap-3 items-baseline"><span className="text-xs font-bold tracking-widest uppercase" style={{ color: FOUNDERS[RESULT_LINE.who].color }}>{FOUNDERS[RESULT_LINE.who].name}</span><span className="text-lg">{RESULT_LINE.text}</span></div>
              <div className="text-sm tracking-widest opacity-60">KEEP BUILDING?</div>
              <BigButton onClick={go}>OF COURSE</BigButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </World>
  )
}
