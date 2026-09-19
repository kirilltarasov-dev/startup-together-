import { create } from 'zustand'
import type { Effects, EventId, GameState, Screen, SceneId } from './types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const newRunId = () => Math.random().toString(36).slice(2, 10)

export const FOUNDERS: GameState['founders'] = {
  kirill: { id: 'kirill', name: 'Kirill', role: 'CTO / product', emoji: '🎧', color: '#4F7CAC', morale: 80, stress: 20 },
  sadman: { id: 'sadman', name: 'Sadman', role: 'Deep backend', emoji: '🧢', color: '#E0A458', morale: 80, stress: 20 },
  sergio: { id: 'sergio', name: 'Sergio', role: 'Sales / hype', emoji: '🕶️', color: '#7FB069', morale: 80, stress: 20 },
}

export const SCENE_LOCATION: Record<SceneId, GameState['location']> = { S1: 'Budapest', S2: 'Debrecen', S3: 'Investor room' }

/** Start state from docs/SKIT.md */
export const initialState = (): GameState => ({
  screen: 'opening',
  scene: 'S1',
  location: 'Budapest',
  day: 1,
  eventIndex: 0,
  resolved: {},
  cash: 37,
  users: 0,
  health: 55,
  morale: 80,
  ownership: 100,
  dailyBurn: 0,
  founders: structuredClone(FOUNDERS),
  missionOutcome: 'none',
  missionMode: null,
  missionEvidence: null,
  runId: newRunId(),
})

/** "unbounded" when burn is 0 — never Infinity/NaN in the UI. */
export const runwayLabel = (s: Pick<GameState, 'cash' | 'dailyBurn'>) =>
  s.dailyBurn <= 0 ? 'unbounded' : `${Math.floor(s.cash / s.dailyBurn)} d`

interface Actions {
  setScreen: (screen: Screen) => void
  goScene: (scene: SceneId) => void
  apply: (fx: Effects) => void
  markResolved: (eventId: EventId, choiceId: string) => void
  nextEvent: () => void
  set: (patch: Partial<GameState>) => void
  restart: () => void
}

export const useGame = create<GameState & Actions>((set, get) => ({
  ...initialState(),

  setScreen: (screen) => set({ screen }),
  goScene: (scene) => set({ scene, location: SCENE_LOCATION[scene], day: scene === 'S1' ? 1 : scene === 'S2' ? 42 : 71 }),
  set: (patch) => set(patch),

  apply: (fx) => {
    const s = get()
    set({
      cash: Math.max(0, s.cash + (fx.cash ?? 0)),
      users: Math.max(0, s.users + (fx.users ?? 0)),
      health: clamp(s.health + (fx.health ?? 0)),
      morale: clamp(s.morale + (fx.morale ?? 0)),
      ownership: fx.ownership ?? s.ownership,
      dailyBurn: fx.dailyBurn ?? s.dailyBurn,
    })
  },

  markResolved: (eventId, choiceId) => set({ resolved: { ...get().resolved, [eventId]: choiceId } }),
  nextEvent: () => set({ eventIndex: get().eventIndex + 1 }),

  restart: () => set({ ...initialState() }),
}))
