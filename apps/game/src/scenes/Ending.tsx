import { motion } from 'framer-motion'
import { BigButton } from '../components/ui'
import { World } from '../components/World'
import { ending } from '../engine/engine'
import { ENDING_LINES } from '../events/skit'
import { FOUNDERS, useGame } from '../state/gameStore'
import { useRun } from '../state/runStore'
import { getLiveClient, ttsReset } from '../voice'

const MODE_LABEL = { live: 'LIVE', cached: 'CACHED REAL RUN', mock: 'MOCK' }

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-8 text-sm border-b border-line/60 py-1.5"><span className="opacity-60">{k}</span><span className="mono font-bold">{v}</span></div>
}

export function Ending() {
  const g = useGame()
  const run = useRun()
  const verdict = ending(g)
  const win = !['BACK TO THE HACKATHON', 'OUT OF RUNWAY', 'THE COMPANY OUTLASTED THE TEAM', 'TECHNICAL DEBT CAME DUE', 'THE DEAL FELL THROUGH'].includes(verdict)
  const line = g.mode === 'campaign' ? { ...ENDING_LINES[win ? 'win' : 'lose'], text: win ? 'It is not just a pitch anymore. Tomorrow we keep the promises that remain.' : 'That is the company our decisions built. Next time, we change the decisions.' } : win ? ENDING_LINES.win : ENDING_LINES.lose
  const ev = g.missionEvidence

  const restart = () => { getLiveClient().disconnect(); ttsReset(); run.clearMission(); g.restart() }

  return (
    <World scene="S3" mood={win ? 'win' : 'lose'}>
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl border border-line bg-[#1A1B1E]/95 p-4 sm:p-8 text-center">
          <div className="text-[10px] tracking-[0.4em] opacity-50">RUNWAY COMPLETE · DAY {g.day}</div>
          <motion.h1 initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }} className={`text-3xl sm:text-6xl font-bold tracking-widest mt-2 ${win ? 'text-mint' : 'text-[#FF5A5F]'}`}>{verdict}</motion.h1>
          <div className="mt-2 text-xl opacity-80">You own {g.ownership}% of it.</div>

          <div className="mt-6 text-left">
            <Row k="Cash" v={`€${g.cash}`} />
            <Row k="Users" v={g.users} />
            <Row k="Health" v={g.health} />
            <Row k="Morale" v={g.morale} />
            {g.mode === 'campaign' && <>
              <Row k="Customer trust / technical debt" v={`${g.trust} / ${g.debt}`} />
              <Row k="Daily revenue / burn" v={`€${g.revenue} / €${g.dailyBurn}`} />
              <Row k="Decisions made" v={Object.keys(g.resolved).length} />
            </>}
            <Row k="Devin mission" v={g.missionMode ? `${MODE_LABEL[g.missionMode]} · ${g.missionOutcome}` : g.missionOutcome === 'skipped' ? 'skipped (feed disabled)' : '—'} />
            {ev && <Row k="Verification" v={`tests ${ev.tests} · p95 ${ev.before.toFixed(3)}s → ${ev.after.toFixed(3)}s`} />}
          </div>

          <div className="mt-6 flex gap-3 items-baseline justify-center">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: FOUNDERS[line.who].color }}>{FOUNDERS[line.who].name}</span>
            <span className="text-lg italic">{line.text}</span>
          </div>

          <div className="mt-8"><BigButton onClick={restart}>RESTART</BigButton></div>
        </motion.div>
      </div>
    </World>
  )
}
