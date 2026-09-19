import { CAMPAIGN_EVENTS } from '../events/campaign.ts'
import type { GameState } from './types'

export const CAMPAIGN_SAVE_KEY = 'runway.campaign.v1'
const numeric = ['cash', 'users', 'health', 'morale', 'ownership', 'dailyBurn', 'trust', 'debt', 'revenue', 'day'] as const

export function decodeCampaignSave(text: string, base: GameState): GameState | null {
  try {
    const data = JSON.parse(text)
    const saved = data.state
    if (data.version !== 1 || saved?.mode !== 'campaign' || !Number.isInteger(saved.eventIndex) || !CAMPAIGN_EVENTS[saved.eventIndex]) return null
    if (!numeric.every((key) => typeof saved[key] === 'number' && Number.isFinite(saved[key]) && saved[key] >= 0 && saved[key] <= 1e12)) return null
    if (!['health', 'morale', 'ownership', 'trust', 'debt'].every((key) => saved[key] <= 100)) return null
    if (typeof saved.runId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(saved.runId)) return null
    const event = CAMPAIGN_EVENTS[saved.eventIndex]
    const state: GameState = { ...base, mode: 'campaign', scene: event.scene, location: event.scene === 'S1' ? 'Budapest' : event.scene === 'S2' ? 'Debrecen' : 'Investor room',
      eventIndex: saved.eventIndex, runId: saved.runId,
      screen: ['play', 'result', 'ending', 'devin'].includes(saved.screen) ? saved.screen : 'play',
      flags: {}, resolved: {}, enteredEvents: {},
    }
    for (const key of numeric) state[key] = saved[key]
    if (saved.flags && typeof saved.flags === 'object') {
      for (const [key, value] of Object.entries(saved.flags)) if (/^[a-zA-Z][a-zA-Z0-9]{0,49}$/.test(key) && typeof value === 'boolean') state.flags[key] = value
    }
    for (const item of CAMPAIGN_EVENTS) {
      const resolved = saved.resolved?.[item.id]
      if ([...item.choices, ...(item.variant?.choices ?? [])].some((choice) => choice.id === resolved)) state.resolved[item.id] = resolved
      if (saved.enteredEvents?.[item.id] === true) state.enteredEvents[item.id] = true
    }
    if (['none', 'success', 'failure', 'skipped'].includes(saved.missionOutcome)) state.missionOutcome = saved.missionOutcome
    if (['live', 'cached', 'mock'].includes(saved.missionMode)) state.missionMode = saved.missionMode
    const evidence = saved.missionEvidence
    if (evidence && /^\d{1,5}\/\d{1,5}$/.test(evidence.tests) && [evidence.before, evidence.after].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) state.missionEvidence = { tests: evidence.tests, before: evidence.before, after: evidence.after }
    return state
  } catch {
    return null
  }
}

export function loadCampaign(base: GameState): GameState | null {
  try {
    const text = localStorage.getItem(CAMPAIGN_SAVE_KEY)
    return text ? decodeCampaignSave(text, base) : null
  } catch {
    return null
  }
}

export function saveCampaign(state: GameState): boolean {
  if (state.mode !== 'campaign' || state.screen === 'opening') return false
  try {
    localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify({ version: 1, state }))
    return true
  } catch {
    return false
  }
}
