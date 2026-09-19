import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BigButton } from '../components/ui'
import { initialState, useGame } from '../state/gameStore'
import { loadCampaign } from '../state/campaignSave'
import { useRun } from '../state/runStore'
import { sfx } from '../state/sfx'

const CARDS: Array<string[]> = [
  ['OBUDA, BUDAPEST', 'SEPTEMBER 19, 2026'],
  ['PUZL COWORKING', 'COGNITION × DEVIN HACKATHON'],
  ['3 FOUNDERS', '€37', '1 AI ENGINEER'],
  ['BUILD SOMETHING', 'PEOPLE WANT.'],
]

export function Opening() {
  const start = useGame((s) => s.start)
  const resume = useGame((s) => s.resumeCampaign)
  const [saved] = useState(() => loadCampaign(initialState()))
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
              className="text-4xl sm:text-8xl font-bold"
            >
              RUNWAY
            </motion.h1>
            <p className="mt-3 opacity-60 tracking-widest text-sm">A STARTUP SURVIVAL GAME · POWERED BY DEVIN</p>
            <img src="/assets/branding/cognition-light.png" alt="Cognition" width={558} height={124} className="mx-auto mt-5 h-8 w-auto" />
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-12">
              <div className="flex flex-wrap justify-center gap-3 px-4">
                <BigButton onClick={() => { useRun.getState().clearMission(); sfx('deploy'); start('demo') }}>START RUNWAY</BigButton>
                <BigButton className="!bg-gold" onClick={() => { useRun.getState().clearMission(); sfx('deploy'); start('campaign') }}>NEW CAMPAIGN</BigButton>
                {saved && <BigButton className="!bg-panel !text-mint border border-line" onClick={() => { useRun.getState().clearMission(); resume() }}>RESUME CAMPAIGN</BigButton>}
              </div>
              <p className="mt-4 text-sm opacity-70">Demo: the original 5 decisions. Campaign: 35 encounters, five chapters, local save.</p>
              <p className="mt-1 text-xs opacity-50">Extended campaign beta · playtime not yet calibrated. New campaign replaces the local campaign save.</p>
              {saved?.resolved.E04 === 'send_devin' && saved.missionOutcome === 'none' && <p className="mx-auto mt-3 max-w-xl text-sm text-gold">An interrupted mission will resume with a manual workaround, not another paid task. Any remote session may still be running.</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-6 text-[10px] opacity-30 tracking-widest">CLICK TO SKIP</div>
    </div>
  )
}
