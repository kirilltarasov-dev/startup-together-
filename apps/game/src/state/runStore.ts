import { create } from 'zustand'
import type { Mode } from '../agents'
import type { MissionStatus } from '../agents/types'
import { envMode } from '../agents'

/** Session-level state (mission plumbing, audio) — not part of the fictional company's GameState. */
interface RunState {
  agentMode: Mode
  mission: { id: string; runId: string; playerConstraint?: string } | null
  status: MissionStatus | null
  muted: boolean
  /** A validated voice choice waiting for the Play scene to apply it (same path as a button). */
  voiceRequest: { eventId: string; choiceId: string; constraint?: string; n: number } | null
  requestVoiceChoice: (eventId: string, choiceId: string, constraint?: string) => void
  setAgentMode: (m: Mode) => void
  setMission: (m: RunState['mission']) => void
  setStatus: (s: MissionStatus | null) => void
  clearMission: () => void
  toggleMute: () => void
}

export const useRun = create<RunState>((set) => ({
  agentMode: envMode,
  mission: null,
  status: null,
  muted: false,
  voiceRequest: null,
  requestVoiceChoice: (eventId, choiceId, constraint) => set((s) => ({ voiceRequest: { eventId, choiceId, constraint, n: (s.voiceRequest?.n ?? 0) + 1 } })),
  setAgentMode: (agentMode) => set({ agentMode }),
  setMission: (mission) => set({ mission, status: null }),
  setStatus: (status) => set({ status }),
  clearMission: () => set({ mission: null, status: null }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}))
