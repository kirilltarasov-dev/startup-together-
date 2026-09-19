import { motion } from 'framer-motion'
import { runwayLabel, useGame } from '../state/gameStore'
import { useRun } from '../state/runStore'
import { AnimatedNumber, fmtEur } from './AnimatedNumber'

function Stat({ icon, label, children, warn }: { icon: string; label: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-1 sm:gap-2">
      <span className="text-sm opacity-70">{icon}</span>
      <span className={`text-lg sm:text-2xl font-bold tabular-nums ${warn ? 'text-blood' : ''}`}>{children}</span>
      <span className="w-full sm:w-auto text-[10px] uppercase tracking-widest opacity-50">{label}</span>
    </div>
  )
}

const MODE_STYLE = { live: 'border-mint text-mint', cached: 'border-gold text-gold', mock: 'border-line opacity-70' }
const MODE_LABEL = { live: 'LIVE', cached: 'CACHED REAL RUN', mock: 'MOCK' }

export function HUD() {
  const s = useGame()
  const { agentMode, muted, toggleMute } = useRun()
  const showMode = s.eventIndex >= 3 || s.screen === 'devin'

  return (
    <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex shrink-0 flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-0 sm:h-20 border-b border-line bg-[#1A1B1E]/90 backdrop-blur z-10">
      <div className="text-xl font-bold tracking-[0.3em]">RUNWAY</div>

      <div className="order-last grid w-full grid-cols-3 gap-x-3 gap-y-2 sm:order-none sm:flex sm:w-auto sm:items-center sm:gap-8">
        <Stat icon="💰" label="cash" warn={s.cash <= 5}><AnimatedNumber value={s.cash} format={fmtEur} className="text-[28px]" /></Stat>
        <Stat icon="👥" label="users"><AnimatedNumber value={s.users} /></Stat>
        <Stat icon="⚙" label="health" warn={s.health < 40}><AnimatedNumber value={s.health} /></Stat>
        <Stat icon="❤️" label="morale"><AnimatedNumber value={s.morale} /></Stat>
        <Stat icon="⏱" label="runway"><span className={s.dailyBurn === 0 ? 'text-base opacity-70' : ''}>{runwayLabel(s)}</span></Stat>
      </div>

      <div className="flex items-center gap-4">
        {showMode && <span className={`text-[10px] tracking-widest px-2 py-1 rounded border ${MODE_STYLE[agentMode]}`}>{MODE_LABEL[agentMode]}</span>}
        <button onClick={toggleMute} className="text-sm opacity-60 hover:opacity-100" title="mute">{muted ? '🔇' : '🔊'}</button>
        <div className="text-right">
          <div className="text-sm font-bold">DAY {s.day}</div>
          <div className="text-[10px] uppercase tracking-widest opacity-50">{s.location}</div>
        </div>
      </div>
    </motion.header>
  )
}
