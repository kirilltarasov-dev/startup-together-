import { create } from 'zustand'
import type { Effects, FounderId, GameState, Idea, Scene } from './types'

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

export const initialFounders: GameState['founders'] = {
  kirill: { id: 'kirill', name: 'Kirill', role: 'Engineering / Product', emoji: '🧑‍💻', morale: 80, stress: 20 },
  rafi: { id: 'rafi', name: 'Rafi', role: 'Growth / Ops', emoji: '📈', morale: 85, stress: 15 },
  valentina: { id: 'valentina', name: 'Valentina', role: 'Design / Sales', emoji: '🎨', morale: 90, stress: 10 },
}

export const initialState: GameState = {
  scene: 'opening',
  day: 1,
  hackathonMinutesLeft: 300,
  location: 'Budapest',
  stage: 'Hackathon',
  idea: null,
  cash: 37,
  revenue: 0,
  dailyBurn: 0,
  users: 0,
  productHealth: 55,
  technicalDebt: 40,
  reputation: 10,
  valuation: 0,
  equity: { founders: 100, investors: 0 },
  founders: structuredClone(initialFounders),
  devinMissions: 0,
  incidentsSurvived: 0,
  shippedBroken: false,
  ending: null,
  log: [],
}

export const runwayDays = (s: Pick<GameState, 'cash' | 'dailyBurn' | 'revenue'>) => {
  const net = s.dailyBurn - s.revenue
  if (net <= 0) return Infinity
  return Math.max(0, Math.floor(s.cash / net))
}

export const teamMorale = (s: Pick<GameState, 'founders'>) =>
  Math.round(Object.values(s.founders).reduce((a, f) => a + f.morale, 0) / 3)

interface Actions {
  setScene: (scene: Scene) => void
  setIdea: (idea: Idea) => void
  apply: (fx: Effects, note?: string) => void
  set: (patch: Partial<GameState>) => void
  advanceDays: (n: number) => void
  reset: () => void
}

export const useGame = create<GameState & Actions>((set, get) => ({
  ...initialState,

  setScene: (scene) => set({ scene }),
  setIdea: (idea) => set({ idea }),
  set: (patch) => set(patch),

  apply: (fx, note) => {
    const s = get()
    const founders = structuredClone(s.founders)
    const bump = (key: 'morale' | 'stress', map?: Partial<Record<FounderId | 'all', number>>) => {
      if (!map) return
      for (const [id, d] of Object.entries(map)) {
        const targets = id === 'all' ? (Object.keys(founders) as FounderId[]) : [id as FounderId]
        for (const t of targets) founders[t][key] = clamp(founders[t][key] + (d ?? 0))
      }
    }
    bump('morale', fx.morale)
    bump('stress', fx.stress)
    set({
      cash: Math.max(0, s.cash + (fx.cash ?? 0)),
      revenue: Math.max(0, s.revenue + (fx.revenue ?? 0)),
      dailyBurn: Math.max(0, s.dailyBurn + (fx.dailyBurn ?? 0)),
      users: Math.max(0, Math.round(s.users + (fx.users ?? 0))),
      productHealth: clamp(s.productHealth + (fx.productHealth ?? 0)),
      technicalDebt: clamp(s.technicalDebt + (fx.technicalDebt ?? 0)),
      reputation: clamp(s.reputation + (fx.reputation ?? 0)),
      valuation: Math.max(0, s.valuation + (fx.valuation ?? 0)),
      equity: fx.investorEquity
        ? { founders: s.equity.founders - fx.investorEquity, investors: s.equity.investors + fx.investorEquity }
        : s.equity,
      hackathonMinutesLeft: Math.max(0, s.hackathonMinutesLeft - (fx.minutes ?? 0)),
      day: s.day + (fx.days ?? 0),
      founders,
      log: note ? [...s.log.slice(-30), note] : s.log,
    })
  },

  advanceDays: (n) => {
    const s = get()
    // organic growth scales with product health & reputation; burn drains cash
    const growth = 1 + (s.productHealth / 100) * 0.04 + (s.reputation / 100) * 0.03
    const users = Math.round(s.users * Math.pow(growth, n) + n * 3)
    const cash = Math.max(0, s.cash + (s.revenue - s.dailyBurn) * n)
    set({ day: s.day + n, users, cash })
  },

  reset: () => set({ ...initialState, founders: structuredClone(initialFounders) }),
}))
