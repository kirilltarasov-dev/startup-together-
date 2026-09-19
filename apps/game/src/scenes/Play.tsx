import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { EventCard } from '../components/EventCard'
import { HUD } from '../components/HUD'
import { World, type Mood } from '../components/World'
import { currentEvent, resolveChoice } from '../engine/engine'
import { DISABLE_FEED_SECOND, EVENTS, MISSION_LINES } from '../events/skit'
import { useGame } from '../state/gameStore'
import { useRun } from '../state/runStore'
import type { Choice, FounderId, GameEvent, Line } from '../state/types'
import { sfx } from '../state/sfx'

/**
 * The event loop across S1/S2/S3. Buttons and voice both end up in `choose()`.
 * Movement/hotspots (docs/DIRECTION.md) can wrap this later: the door button below is the "Walk there" fallback.
 */
export function Play({ voiceSlot }: { voiceSlot?: React.ReactNode }) {
  const g = useGame()
  const run = useRun()
  const event = currentEvent(g)
  const [reaction, setReaction] = useState<Line[] | null>(null)
  const [speaker, setSpeaker] = useState<FounderId | undefined>()
  const [shake, setShake] = useState(false)
  const [door, setDoor] = useState(false)
  const [entered, setEntered] = useState<string | null>(null)

  // onEnter effects (E04: users +800, health -25) exactly once
  useEffect(() => {
    if (!event || entered === event.id) return
    setEntered(event.id)
    setReaction(null)
    if (event.onEnter) {
      g.apply(event.onEnter)
      if (event.id === 'E04') { sfx('incident', 0.7); setShake(true); setTimeout(() => setShake(false), 600) }
    }
  }, [event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // returning from mission control: show the verified lines
  useEffect(() => {
    if (event?.id === 'E04' && g.resolved.E04 === 'send_devin' && g.missionOutcome !== 'none' && !reaction) {
      setReaction(g.missionOutcome === 'success' ? MISSION_LINES.success : g.missionOutcome === 'failure' ? MISSION_LINES.failure : [{ who: 'sergio', text: 'We fixed it by deleting it. Pivot!' }, DISABLE_FEED_SECOND])
    }
  }, [event?.id, g.missionOutcome]) // eslint-disable-line react-hooks/exhaustive-deps

  const urgent = event?.id === 'E04' && !g.resolved.E04
  const mood: Mood = urgent ? 'alarm' : event?.id === 'E04' && g.missionOutcome === 'success' ? 'win' : event?.id === 'E04' && g.missionOutcome === 'failure' ? 'lose' : 'idle'

  /** Single entry point for buttons AND voice (via App → connectVoiceBridge). */
  const choose = (c: Choice, constraint?: string) => {
    if (!event) return
    if (c.engineeringMission) {
      if (g.resolved[event.id]) return
      g.markResolved(event.id, c.id)
      run.setMission({ id: '', runId: g.runId, playerConstraint: constraint })
      g.setScreen('devin')
      return
    }
    const applied = resolveChoice(event, c.id)
    if (!applied) return
    if (c.kind === 'danger') { sfx('error'); setShake(true); setTimeout(() => setShake(false), 500) }
    if (c.kind === 'money') sfx('cash')
    const lines: Line[] = applied.reaction ? [applied.reaction] : []
    if (c.id === 'disable_feed') { lines.push(DISABLE_FEED_SECOND); g.set({ missionOutcome: 'skipped' }) }
    setReaction(lines)
  }

  // voice → same path as a button
  useEffect(() => {
    const vr = run.voiceRequest
    if (!event || !vr || vr.eventId !== event.id) return
    const c = event.choices.find((x) => x.id === vr.choiceId)
    if (c) choose(c, vr.constraint)
  }, [run.voiceRequest?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) return null

  const next = () => {
    const idx = g.eventIndex
    const nextEv: GameEvent | undefined = EVENTS[idx + 1]
    if (event.id === 'E02') { g.setScreen('result'); return }
    if (!nextEv) { g.setScreen('ending'); return }
    if (nextEv.scene !== event.scene) { setDoor(true); return }
    g.nextEvent()
  }

  const walkThroughDoor = () => {
    const nextEv = EVENTS[g.eventIndex + 1]
    sfx('door')
    setDoor(false)
    g.goScene(nextEv.scene)
    g.nextEvent()
  }

  return (
    <div className="h-full flex flex-col">
      <HUD />
      <World key={g.scene} scene={g.scene} mood={mood} active={speaker} shake={shake}>
        <AnimatePresence mode="wait">
          {door ? (
            <motion.div key="door" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl rounded-2xl border border-gold/60 bg-[#1A1B1E]/95 p-6 flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-[0.3em] text-gold">DOOR UNLOCKED</div>
                <div className="text-2xl font-bold">{g.scene === 'S1' ? 'Leave the hackathon → Debrecen' : 'Leave the apartment → Investor room'}</div>
              </div>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={walkThroughDoor} className="px-8 py-3 rounded-full bg-gold text-ink font-bold tracking-widest">WALK THERE</motion.button>
            </motion.div>
          ) : (
            <EventCard key={event.id} event={event} reaction={reaction} onChoose={(c) => choose(c)} onContinue={next} onSpeaker={setSpeaker} urgent={urgent} voiceSlot={voiceSlot} />
          )}
        </AnimatePresence>
      </World>
    </div>
  )
}
