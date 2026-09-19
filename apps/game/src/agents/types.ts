/**
 * Frontend view of the mission contract. Source of truth: docs/LANE_C_SADMAN.md TASK 2 (Lane C owns the server side).
 */
export type Mode = 'live' | 'cached' | 'mock'

export type Phase =
  | 'queued'
  | 'running'
  | 'awaiting_verification'
  | 'succeeded'
  | 'failed'
  | 'needs_attention'
  | 'timed_out'
  | 'cancelled'

export const TERMINAL: ReadonlySet<Phase> = new Set<Phase>(['succeeded', 'failed', 'needs_attention', 'timed_out', 'cancelled'])

export interface LogLine {
  t: number
  text: string
  kind?: 'info' | 'tool' | 'ok' | 'err'
}

export interface Verification {
  tests: { passed: number; total: number; ok: boolean }
  benchmark: { before: number; after: number; threshold: number; unit: 's'; samples: number; ok: boolean }
  filesChanged: string[]
  baselineCommit: string
  candidateCommit: string
}

export interface MissionResult {
  success: boolean
  summary: string
  verification: Verification
  verifiedAt: string
}

export interface MissionError {
  code: 'provider_down' | 'credits' | 'auth' | 'timeout' | 'outside_allowed_paths' | 'internal'
  message: string
}

export interface MissionStatus {
  id: string
  runId: string
  mode: Mode
  phase: Phase
  elapsedSec: number
  statusDetail?: string
  sessionUrl?: string
  log: LogLine[]
  result?: MissionResult
  error?: MissionError
}

export interface MissionRequest {
  runId: string
  incidentId: 'optimize_feed'
  idempotencyKey: string
  playerConstraint?: string
}

export interface EngineeringAgent {
  readonly mode: Mode
  createTask(req: MissionRequest): Promise<{ id: string; phase: Phase; mode: Mode; attached?: boolean }>
  getStatus(id: string): Promise<MissionStatus>
  cancel(id: string): Promise<void>
}
