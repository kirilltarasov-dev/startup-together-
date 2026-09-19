import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { connectVoiceBridge, currentEvent } from './engine/engine'
import { DevinMode } from './scenes/DevinMode'
import { Ending } from './scenes/Ending'
import { Opening } from './scenes/Opening'
import { Play } from './scenes/Play'
import { Result } from './scenes/Result'
import { useGame } from './state/gameStore'
import { useRun } from './state/runStore'
import { VoiceButton } from './voice'

export default function App() {
  const screen = useGame((s) => s.screen)

  // Voice (Lane V) → same validated path as buttons. The Play scene consumes runStore.voiceRequest.
  useEffect(() => connectVoiceBridge((event, choiceId, constraint) => {
    const ev = currentEvent(useGame.getState())
    if (!ev || ev.id !== event.id || !ev.choices.some((c) => c.id === choiceId)) return false
    useRun.getState().requestVoiceChoice(event.id, choiceId, constraint)
    return true
  }), [])

  return (
    <div className="h-full bg-ink text-[#F5F5F4] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div key={screen} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          {screen === 'opening' && <Opening />}
          {screen === 'play' && <Play voiceSlot={<VoiceButton />} />}
          {screen === 'result' && <Result />}
          {screen === 'devin' && <DevinMode />}
          {screen === 'ending' && <Ending />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
