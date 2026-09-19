import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { FOUNDERS } from '../state/gameStore'
import type { Choice, FounderId, GameEvent, Line } from '../state/types'
import { ChoiceButton } from './ui'

interface Props {
  event: GameEvent
  reaction: Line[] | null            // set after a choice is made
  onChoose: (choice: Choice) => void
  onContinue: () => void
  onSpeaker: (who: FounderId | undefined) => void
  urgent?: boolean
  voiceSlot?: React.ReactNode         // Lane V mounts <VoiceButton/> here
}

function Speech({ line }: { line: Line }) {
  const f = FOUNDERS[line.who]
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 items-baseline">
      <span className="text-xs font-bold tracking-widest uppercase w-20 shrink-0" style={{ color: f.color }}>{f.name}</span>
      <span className="text-lg leading-snug">{line.text}</span>
    </motion.div>
  )
}

export function EventCard({ event, reaction, onChoose, onContinue, onSpeaker, urgent, voiceSlot }: Props) {
  const [shown, setShown] = useState(0)

  // reveal dialogue line by line, highlight the speaker
  useEffect(() => {
    setShown(0)
    let i = 0
    const tick = () => {
      i++
      setShown(i)
      onSpeaker(event.dialogue[i - 1]?.who)
      if (i < event.dialogue.length) t = setTimeout(tick, 1100)
    }
    let t = setTimeout(tick, 300)
    return () => clearTimeout(t)
  }, [event.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (reaction) onSpeaker(reaction[0]?.who) }, [reaction]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = shown >= event.dialogue.length

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      className={`w-full max-w-4xl rounded-2xl border bg-[#1A1B1E]/95 backdrop-blur p-6 ${urgent ? 'border-[#FF5A5F] shadow-[0_0_60px_-15px_#FF5A5F]' : 'border-line'}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-[10px] tracking-[0.3em] ${urgent ? 'text-[#FF5A5F]' : 'opacity-50'}`}>{event.id} · {urgent ? 'PRODUCTION INCIDENT' : event.chapter ?? event.scene}</div>
          <h2 className="text-3xl font-bold leading-tight">{event.title}</h2>
        </div>
        {event.voice && ready && !reaction && voiceSlot}
      </div>

      <div className="mt-4 space-y-2 min-h-[5.5rem]">
        {event.dialogue.slice(0, shown).map((l, i) => <Speech key={i} line={l} />)}
      </div>

      {ready && !reaction && event.conversations?.map((conversation) => <details key={conversation.label} className="mt-3 rounded border border-line p-3" onToggle={(e) => { if (e.currentTarget.open) onSpeaker(conversation.lines[0]?.who) }}>
        <summary className="cursor-pointer text-sm text-mint focus-visible:ring-2 focus-visible:ring-mint">{conversation.label}</summary>
        <section className="mt-3 space-y-2">{conversation.lines.map((line, i) => <Speech key={i} line={line} />)}</section>
      </details>)}
      <AnimatePresence mode="wait">
        {reaction ? (
          <motion.div key="reaction" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border-t border-line pt-4">
            <div className="space-y-2">{reaction.map((l, i) => <Speech key={i} line={l} />)}</div>
            <div className="mt-4 flex justify-end">
              <motion.button whileHover={{ x: 4 }} onClick={onContinue} className="font-bold tracking-widest text-sm px-5 py-2 rounded-full bg-white text-ink">
                CONTINUE →
              </motion.button>
            </div>
          </motion.div>
        ) : ready ? (
          <motion.div key="choices" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5">
            {event.prompt && <div className="text-xs tracking-widest uppercase opacity-60 mb-2">{event.prompt}</div>}
            <div className="grid grid-cols-2 gap-3">
              {event.choices.map((c, i) => <ChoiceButton key={c.id} choice={c} index={i} onClick={() => onChoose(c)} />)}
            </div>
          </motion.div>
        ) : (
          <motion.button key="skip" onClick={() => setShown(event.dialogue.length)} className="mt-5 text-xs opacity-40 hover:opacity-80 tracking-widest">SKIP ▸</motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
