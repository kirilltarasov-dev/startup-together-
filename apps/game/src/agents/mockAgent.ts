import type { EngineeringAgent, LogLine, MissionRequest, MissionResult, MissionStatus, Mode } from './types'

/** Replay fixture. MOCK = synthetic dev fixture. CACHED = a recorded real run saved by Lane C in cache/optimize_feed.json. */
export interface Recording {
  log: Array<[number, string, LogLine['kind']?]>
  result: MissionResult
  sessionUrl?: string
  recordedAt?: string
  verifyStartSec?: number
}

/** Deterministic development fixture. Clearly labelled MOCK in the UI; never described as real engineering. */
export const MOCK_RECORDING: Recording = {
  log: [
    [0, 'mock: mission queued (no provider call)', 'info'],
    [2, 'mock: provider status running', 'info'],
    [14, 'mock: provider status running / finished', 'info'],
    [15, 'verifier: fetched candidate branch devin/optimize-feed (mock sha)', 'tool'],
    [16, 'verifier: changed paths inside startup-repo/backend/ — ok', 'ok'],
    [17, 'verifier: python -m pytest -q → 9 passed', 'ok'],
    [19, 'verifier: benchmark p95 baseline 2.310s → candidate 0.041s (threshold 0.5s)', 'ok'],
  ],
  verifyStartSec: 15,
  result: {
    success: true,
    summary: 'MOCK FIXTURE — not a real run. Simulated root cause: N+1 query pattern in get_feed().',
    verification: {
      tests: { passed: 9, total: 9, ok: true },
      benchmark: { before: 2.31, after: 0.041, threshold: 0.5, unit: 's', samples: 12, ok: true },
      filesChanged: ['startup-repo/backend/feed.py', 'startup-repo/backend/database.py'],
      baselineCommit: 'mock0000',
      candidateCommit: 'mock1111',
    },
    verifiedAt: '1970-01-01T00:00:00Z',
  },
}

export class ReplayAgent implements EngineeringAgent {
  private tasks = new Map<string, { started: number; runId: string }>()
  readonly mode: Exclude<Mode, 'live'>
  private rec: Recording
  private speed: number
  constructor(mode: Exclude<Mode, 'live'>, rec: Recording, speed = 1) {
    this.mode = mode
    this.rec = rec
    this.speed = speed
  }

  async createTask(req: MissionRequest) {
    const id = `${this.mode}-${req.idempotencyKey}`
    if (!this.tasks.has(id)) this.tasks.set(id, { started: Date.now(), runId: req.runId })
    return { id, phase: 'queued' as const, mode: this.mode }
  }

  async getStatus(id: string): Promise<MissionStatus> {
    const t = this.tasks.get(id)
    if (!t) return { id, runId: '', mode: this.mode, phase: 'needs_attention', elapsedSec: 0, log: [], error: { code: 'internal', message: 'unknown task' } }
    const elapsed = ((Date.now() - t.started) / 1000) * this.speed
    const log = this.rec.log.filter(([at]) => at <= elapsed).map(([at, text, kind]) => ({ t: at, text, kind }))
    const last = this.rec.log[this.rec.log.length - 1][0]
    const verifyAt = this.rec.verifyStartSec ?? last
    const base = { id, runId: t.runId, mode: this.mode, elapsedSec: Math.floor(elapsed / this.speed), log, sessionUrl: this.rec.sessionUrl }
    if (elapsed < verifyAt) return { ...base, phase: elapsed < 1 ? 'queued' : 'running', statusDetail: this.mode === 'mock' ? 'mock: running' : 'replay: running' }
    if (elapsed <= last + 1) return { ...base, phase: 'awaiting_verification', statusDetail: 'verifier running' }
    return { ...base, phase: this.rec.result.success ? 'succeeded' : 'failed', result: this.rec.result }
  }

  async cancel() {}
}
