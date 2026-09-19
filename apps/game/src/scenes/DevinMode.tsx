import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { makeAgent } from '../agents'
import type { EngineeringAgent, MissionResult, MissionStatus } from '../agents/types'
import { TERMINAL } from '../agents/types'
import { HUD } from '../components/HUD'
import { BigButton } from '../components/ui'
import { World } from '../components/World'
import { MISSION_EFFECTS } from '../engine/engine'
import { MISSION_LINES, WAITING_LINES } from '../events/skit'
import { FOUNDERS, useGame } from '../state/gameStore'
import { useRun } from '../state/runStore'
import { sfx } from '../state/sfx'

const MISSION_PROMPT = `Work ONLY inside startup-repo/ of kirilltarasov-dev/startup-together- (FastAPI + SQLite).
Production incident: GET /feed is extremely slow under load. Fix the bottleneck in backend/feed.py while preserving
the exact output shape, ordering (newest first), like counts and pro_likes semantics. Do not change tests/, benchmark/,
schema or the HTTP API. Run pytest and the benchmark before and after. Push to branch devin/optimize-feed. Do not merge.`

const PHASE_LABEL: Record<MissionStatus['phase'], string> = {
  queued: 'QUEUED', running: 'DEVIN WORKING', awaiting_verification: 'INDEPENDENT VERIFICATION', succeeded: 'VERIFIED SUCCESS', failed: 'VERIFIED FAILURE',
  needs_attention: 'NEEDS ATTENTION', timed_out: 'TIMED OUT', cancelled: 'CANCELLED',
}
const MODE_LABEL = { live: 'LIVE', cached: 'CACHED REAL RUN', mock: 'MOCK' }
const MODE_STYLE = { live: 'border-mint text-mint', cached: 'border-gold text-gold', mock: 'border-line opacity-80' }
const MAX_WAIT = 180

export function DevinMode() {
  const g = useGame()
  const run = useRun()
  const [agent, setAgent] = useState<EngineeringAgent | null>(null)
  const [status, setStatus] = useState<MissionStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [extended, setExtended] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lineIdx, setLineIdx] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<number | null>(null)

  const terminal = !!status && TERMINAL.has(status.phase)
  const result = status?.result
  const timedOut = !terminal && elapsed >= (extended ? MAX_WAIT + 120 : MAX_WAIT)

  const launch = async (mode = run.agentMode) => {
    setError(null); setStatus(null); setElapsed(0)
    if (pollRef.current) window.clearTimeout(pollRef.current)
    const a = await makeAgent(mode)
    setAgent(a); run.setAgentMode(a.mode)
    try {
      const { id } = await a.createTask({ runId: g.runId, incidentId: 'optimize_feed', idempotencyKey: `${g.runId}-optimize_feed`, playerConstraint: run.mission?.playerConstraint })
      run.setMission({ id, runId: g.runId, playerConstraint: run.mission?.playerConstraint })
      const poll = async () => {
        try {
          const st = await a.getStatus(id)
          if (st.runId && st.runId !== g.runId) return // stale result from an earlier game
          if (st.phase === 'awaiting_verification' && status?.phase !== 'awaiting_verification') sfx('chime', 0.4)
          setStatus(st); run.setStatus(st)
          if (!TERMINAL.has(st.phase)) pollRef.current = window.setTimeout(poll, a.mode === 'live' ? 3000 : 1000)
        } catch (e) { setError(String(e)) }
      }
      poll()
    } catch (e) { setError(String(e)) }
  }

  useEffect(() => { launch(); return () => { if (pollRef.current) window.clearTimeout(pollRef.current) } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (terminal) return; const iv = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(iv) }, [terminal])
  useEffect(() => { if (terminal) return; const iv = setInterval(() => setLineIdx((i) => (i + 1) % WAITING_LINES.length), 20000); return () => clearInterval(iv) }, [terminal])
  useEffect(() => { if (result) sfx(result.success ? 'win' : 'lose', 0.8) }, [result?.success]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [status?.log.length])

  const finish = (r: MissionResult | null, outcome: 'success' | 'failure' | 'skipped') => {
    if (outcome === 'success') g.apply(MISSION_EFFECTS.success)
    else if (outcome === 'failure') g.apply(MISSION_EFFECTS.failure)
    else g.apply({ health: 10, users: -300 })
    g.set({
      missionOutcome: outcome,
      missionMode: outcome === 'skipped' ? null : (status?.mode ?? run.agentMode),
      missionEvidence: r ? { tests: `${r.verification.tests.passed}/${r.verification.tests.total}`, before: r.verification.benchmark.before, after: r.verification.benchmark.after } : null,
      screen: 'play',
    })
  }

  const waitingLine = WAITING_LINES[lineIdx]

  return (
    <div className="h-full flex flex-col">
      <HUD />
      <World scene="devin" mood={result ? (result.success ? 'win' : 'lose') : 'devin'}>
        <div className="absolute inset-0 grid grid-cols-[1fr_1.3fr] gap-5 p-6 pt-10">
          {/* LEFT: mission + verification */}
          <div className="flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl border border-devin/40 bg-[#1A1B1E]/90 p-5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] tracking-[0.4em] text-devin">MISSION · optimize_feed</div>
                <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded border ${MODE_STYLE[status?.mode ?? run.agentMode]}`}>{MODE_LABEL[status?.mode ?? run.agentMode]}</span>
              </div>
              <div className="h-px bg-devin/40 my-2" />
              <pre className="mono text-[11px] leading-relaxed whitespace-pre-wrap opacity-80">{MISSION_PROMPT}{run.mission?.playerConstraint ? `\n\nPLAYER CONSTRAINT: ${run.mission.playerConstraint}` : ''}</pre>
            </div>

            <div className="rounded-2xl border border-line bg-[#1A1B1E]/90 p-5 flex-1 min-h-0 overflow-auto">
              <div className="text-[10px] tracking-[0.4em] opacity-60">VERIFICATION · runs on our server, not Devin's word</div>
              <div className="h-px bg-line my-2" />
              {result ? <Verification r={result} /> : (
                <div className="opacity-50 text-sm mt-3">{status?.phase === 'awaiting_verification' ? <span className="text-gold">Fetching candidate branch, running pytest + benchmark<span className="blink">_</span></span> : 'Appears only when our verifier runs.'}</div>
              )}
            </div>
          </div>

          {/* RIGHT: status + founders */}
          <div className="flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl border border-line bg-black/60 p-5 flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] tracking-[0.4em] opacity-60">STATUS</div>
                <div className="mono text-sm opacity-70">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</div>
              </div>
              <motion.div key={status?.phase} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`mt-2 text-2xl font-bold tracking-widest ${status?.phase === 'succeeded' ? 'text-mint' : status?.phase === 'failed' ? 'text-[#FF5A5F]' : 'text-devin'}`}>
                ● {status ? PHASE_LABEL[status.phase] : 'CONNECTING'}
              </motion.div>
              {status?.statusDetail && <div className="mono text-xs opacity-60 mt-1">{status.statusDetail}</div>}
              {status?.sessionUrl && <a href={status.sessionUrl} target="_blank" rel="noreferrer" className="text-xs text-devin underline mt-1 opacity-80">open Devin session ↗</a>}
              <div ref={logRef} className="mt-3 flex-1 overflow-y-auto mono text-[12px] leading-relaxed space-y-1 pr-2">
                {status?.log.map((l, i) => (
                  <div key={i} className={l.kind === 'ok' ? 'text-mint' : l.kind === 'err' ? 'text-[#FF5A5F]' : l.kind === 'tool' ? 'text-devin/90' : 'opacity-70'}>
                    <span className="opacity-40 mr-2">{String(Math.floor(l.t)).padStart(3, ' ')}s</span>{l.text}
                  </div>
                ))}
                {!terminal && !error && <div className="text-devin"><span className="blink">▋</span></div>}
                {(error || status?.error) && <div className="text-[#FF5A5F]">✗ {error ?? `${status?.error?.code}: ${status?.error?.message}`}</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-[#1A1B1E]/80 p-4">
              {!terminal && (
                <div className="flex gap-3 items-baseline mt-2"><span className="text-xs font-bold tracking-widest uppercase" style={{ color: FOUNDERS[waitingLine.who].color }}>{FOUNDERS[waitingLine.who].name}</span><span className="text-sm">{waitingLine.text}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* TIMEOUT / ERROR */}
        <AnimatePresence>
          {(timedOut || status?.phase === 'needs_attention' || status?.phase === 'timed_out' || error) && !result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-4">
              <div className="text-[10px] tracking-[0.4em] text-gold">{error || status?.error ? 'INFRASTRUCTURE ERROR — NOT A VERIFIED RESULT' : 'STILL WAITING'}</div>
              <div className="flex gap-3 items-baseline"><span className="text-xs font-bold tracking-widest uppercase" style={{ color: FOUNDERS.kirill.color }}>KIRILL</span><span className="text-2xl">{MISSION_LINES.timeout.text}</span></div>
              <div className="flex gap-3 mt-4">
                {!extended && timedOut && <BigButton onClick={() => setExtended(true)}>KEEP WAITING (+2 MIN)</BigButton>}
                <BigButton className="!bg-transparent !text-white border border-line" onClick={() => { agent?.cancel(run.mission?.id ?? ''); finish(null, 'skipped') }}>MANUAL WORKAROUND · DISABLE FEED</BigButton>
                {run.agentMode === 'live' && <BigButton className="!bg-gold" onClick={() => launch('cached')}>SHOW TODAY'S REAL RUN (CACHED)</BigButton>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESULT */}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} className={`text-7xl font-bold tracking-widest ${result.success ? 'text-mint' : 'text-[#FF5A5F]'}`}>
                {result.success ? 'INCIDENT RESOLVED' : 'FIX REJECTED'}
              </motion.div>
              <div className="mt-3 max-w-2xl text-center opacity-80">{result.summary}</div>
              <div className="mt-2 mono text-sm opacity-70">tests {result.verification.tests.passed}/{result.verification.tests.total} · p95 {result.verification.benchmark.before.toFixed(3)}s → {result.verification.benchmark.after.toFixed(3)}s · {result.verification.baselineCommit.slice(0, 7)}→{result.verification.candidateCommit.slice(0, 7)}</div>
              <div className={`mt-2 text-[10px] tracking-widest px-2 py-0.5 rounded border ${MODE_STYLE[status!.mode]}`}>{MODE_LABEL[status!.mode]}</div>
              <div className="mt-8"><BigButton onClick={() => finish(result, result.success ? 'success' : 'failure')}>BACK TO THE APARTMENT</BigButton></div>
            </motion.div>
          )}
        </AnimatePresence>
      </World>
    </div>
  )
}

function Verification({ r }: { r: MissionResult }) {
  const v = r.verification
  const pct = (v.tests.passed / Math.max(1, v.tests.total)) * 100
  return (
    <div className="space-y-5 mt-2">
      <div>
        <div className="flex justify-between text-sm"><span>Tests</span><span className={`mono font-bold ${v.tests.ok ? 'text-mint' : 'text-[#FF5A5F]'}`}>{v.tests.passed} / {v.tests.total}</span></div>
        <div className="h-2 bg-white/10 rounded mt-1 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2 }} className={`h-full ${v.tests.ok ? 'bg-mint' : 'bg-[#FF5A5F]'}`} /></div>
      </div>
      <div>
        <div className="text-sm mb-1">Latency p95 · {v.benchmark.samples} samples · threshold {v.benchmark.threshold}s</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/5 p-3"><div className="text-[10px] opacity-50">BASELINE</div><div className="mono text-2xl text-[#FF5A5F]">{v.benchmark.before.toFixed(3)}s</div></div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="rounded-lg bg-white/5 p-3"><div className="text-[10px] opacity-50">CANDIDATE</div><div className={`mono text-2xl ${v.benchmark.ok ? 'text-mint' : 'text-[#FF5A5F]'}`}>{v.benchmark.after.toFixed(3)}s</div></motion.div>
        </div>
      </div>
      <div>
        <div className="text-[10px] opacity-50">FILES CHANGED · {v.baselineCommit.slice(0, 7)} → {v.candidateCommit.slice(0, 7)}</div>
        <div className="mono text-xs mt-1 space-y-0.5">{v.filesChanged.map((f) => <div key={f}>± {f}</div>)}</div>
      </div>
    </div>
  )
}
