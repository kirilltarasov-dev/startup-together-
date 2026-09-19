import type { Effects, GameState } from '../state/types'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function applyEffects(state: GameState, fx: Effects): Partial<GameState> {
  return {
    cash: Math.max(0, state.cash + (fx.cash ?? 0) + (state.mode === 'campaign' ? Math.max(0, fx.days ?? 0) * (state.revenue - state.dailyBurn) : 0)),
    users: Math.max(0, Math.round(state.users + (fx.users ?? 0))),
    health: clamp(state.health + (fx.health ?? 0)),
    morale: clamp(state.morale + (fx.morale ?? 0)),
    ownership: clamp(fx.ownership ?? state.ownership),
    dailyBurn: Math.max(0, fx.dailyBurn ?? state.dailyBurn),
    trust: clamp(state.trust + (fx.trust ?? 0)),
    debt: clamp(state.debt + (fx.debt ?? 0)),
    revenue: Math.max(0, state.revenue + (fx.revenue ?? 0)),
    day: state.day + Math.max(0, fx.days ?? 0),
    flags: { ...state.flags, ...fx.flags },
  }
}
