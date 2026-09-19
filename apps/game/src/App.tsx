import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { connectVoiceBridge, currentEvent } from './engine/engine'
import { DevinMode } from './scenes/DevinMode'
import { Ending } from './scenes/Ending'
import { Opening } from './scenes/Opening'
import { Play } from './scenes/Play'
import { Result } from './scenes/Result'
import { useGame } from './state/gameStore'
import { useRun } from './state/runStore'
import { VoiceButton, getLiveClient, initTts, stageInit, ttsSetMuted, ttsVoiceReport } from './voice'

export default function App() {
  const screen = useGame((s) => s.screen)
  // The live session is a singleton and survives screen changes; show a Mute/Disconnect pill off the Play screen.
  const [voiceOn, setVoiceOn] = useState(false)
  useEffect(() => getLiveClient().subscribe((s) => { setVoiceOn(s.status !== 'idle'); ttsSetMuted(s.muted) }), [])
  // Scripted founder lines: one serialized speech queue (stageManager) -> live voice for Sergio/Investor, local TTS otherwise.
  useEffect(() => {
    const offTts = initTts() // voice-list warmup
    const offStage = stageInit()
    ;(window as unknown as { runwayVoices?: () => Record<string, string> }).runwayVoices = ttsVoiceReport
    return () => { offStage(); offTts() }
  }, [])

  // Voice (Lane V) → same validated path as buttons. The Play scene consumes runStore.voiceRequest.
  useEffect(() => connectVoiceBridge((event, choiceId, constraint) => {
    const ev = currentEvent(useGame.getState())
    if (!ev || ev.id !== event.id || (choiceId !== 'continue' && !ev.choices.some((c) => c.id === choiceId))) return false
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
      {voiceOn && screen !== 'play' && (
        <div className="fixed top-3 right-3 z-50 rounded-2xl border border-white/10 bg-[#1A1B1E]/90 backdrop-blur px-3 py-2">
          <VoiceButton />
        </div>
      )}
    </div>
  )
}
