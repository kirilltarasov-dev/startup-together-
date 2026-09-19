import { create } from 'zustand'
import type { Effects, EventId, GameMode, GameState, Screen, SceneId } from './types'
import { applyEffects } from '../engine/effects.ts'
import { loadCampaign, saveCampaign } from './campaignSave.ts'
const newRunId = () => Math.random().toString(36).slice(2, 10)

export const FOUNDERS: GameState['founders'] = {
  kirill: { id: 'kirill', name: 'Kirill', role: 'CTO / product', emoji: '🎧', color: '#4F7CAC', morale: 80, stress: 20 },
  sadman: { id: 'sadman', name: 'Sadman', role: 'Deep backend', emoji: '🧢', color: '#E0A458', morale: 80, stress: 20 },
  sergio: { id: 'sergio', name: 'Sergio', role: 'Sales / hype', emoji: '🕶️', color: '#7FB069', morale: 80, stress: 20 },
}

export const SCENE_LOCATION: Record<SceneId, GameState['location']> = { S1: 'Budapest', S2: 'Debrecen', S3: 'Investor room' }

/** Start state from docs/SKIT.md */
export const initialState = (): GameState => ({
  mode: 'demo', trust: 50, debt: 30, revenue: 0, flags: {}, enteredEvents: {},
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
  start: (mode: GameMode) => void
  resumeCampaign: () => boolean
  enterEvent: (id: EventId, fx?: Effects) => void
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

  start: (mode) => set({ ...initialState(), mode, screen: 'play' }),
  resumeCampaign: () => {
    const saved = loadCampaign(initialState())
    if (!saved) return false
    if (saved.missionOutcome === 'none' && saved.resolved.E04 === 'send_devin') {
      Object.assign(saved, applyEffects(saved, { health: 10, users: -300, flags: { interruptedMission: true } }))
      saved.missionOutcome = 'skipped'
      saved.screen = 'play'
    }
    set(saved)
    return true
  },
  enterEvent: (id, fx) => {
    const state = get()
    if (state.enteredEvents[id]) return
    set({ ...applyEffects(state, fx ?? {}), enteredEvents: { ...state.enteredEvents, [id]: true } })
  },
  setScreen: (screen) => set({ screen }),
  goScene: (scene) => set({ scene, location: SCENE_LOCATION[scene], day: Math.max(get().day, scene === 'S1' ? 1 : scene === 'S2' ? 42 : 71) }),
  set: (patch) => set(patch),

  apply: (fx) => set(applyEffects(get(), fx)),

  markResolved: (eventId, choiceId) => set({ resolved: { ...get().resolved, [eventId]: choiceId } }),
  nextEvent: () => set({ eventIndex: get().eventIndex + 1 }),

  restart: () => set({ ...initialState() }),
}))

useGame.subscribe((state) => { saveCampaign(state) })
