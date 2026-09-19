/** Pure game rules from docs/SKIT.md. No rendering, no input. */
import { EVENTS } from '../events/skit'
import { useGame } from '../state/gameStore'
import { _setVoiceContext, _setVoiceDispatcher, type VoiceContext } from '../state/voiceBridge'
import type { Choice, GameEvent, GameState } from '../state/types'

export const currentEvent = (s: Pick<GameState, 'eventIndex'>): GameEvent | undefined => EVENTS[s.eventIndex]

/** Verified mission effects (frozen). */
export const MISSION_EFFECTS = {
  success: { health: 40, users: 50 },
  failure: { health: -15, users: -150 },
} as const

/** Ending rule: cash > 0 and health >= 50 → still in business. */
export const ending = (s: Pick<GameState, 'cash' | 'health'>) => (s.cash > 0 && s.health >= 50 ? 'STILL IN BUSINESS' : 'BACK TO THE HACKATHON')

/**
 * Apply a choice exactly once. Returns false if the event was already resolved or the id is illegal.
 * Engineering choices (send_devin) are not applied here; the caller opens mission control.
 */
export function resolveChoice(event: GameEvent, choiceId: string): Choice | null {
  const g = useGame.getState()
  if (g.resolved[event.id]) return null
  const choice = event.choices.find((c) => c.id === choiceId)
  if (!choice) return null
  g.markResolved(event.id, choice.id)
  if (choice.effects) g.apply(choice.effects)
  return choice
}

// ---------- voice context (docs/VOICE.md) ----------

export function buildVoiceContext(event: GameEvent | undefined, s: GameState): VoiceContext | null {
  if (!event?.voice || s.resolved[event.id]) return null
  const allowed = event.choices.map((c) => ({ id: c.id, label: c.label }))
  let contextText = ''
  if (event.id === 'E01') {
    contextText = `CURRENT EVENT: E01 "What are we building?"
GAME STATE: cash ${s.cash}, users ${s.users}, health ${s.health}, morale ${s.morale}.
YOUR ROLE: Sadman and Sergio reacting to Kirill's pitch.
ALLOWED CHOICES: focused = "founders only" (small, focused); broad = "everyone with a pitch" (wide, noisy).
Sergio wants broad and a launch tweet tonight; Sadman worries about noisy data. Let the player's pitch decide.`
  } else if (event.id === 'E04') {
    contextText = `CURRENT EVENT: E04 "We went viral, the feed is dying"
GAME STATE: users ${s.users}, health ${s.health}. Production is slow.
YOUR ROLE: Sadman and Sergio under pressure. The player is giving orders to Devin, the AI engineer.
ALLOWED CHOICES: send_devin = ask Devin to fix the feed (real engineering);
disable_feed = turn the feed off manually (safe, loses users).
If send_devin, put any single instruction the player gave Devin into \`constraint\` (max 200 chars).`
  } else if (event.id === 'E05') {
    contextText = `CURRENT EVENT: E05 "The offer"
GAME STATE: cash ${s.cash}, users ${s.users}, health ${s.health}, ownership ${s.ownership}%. Devin outcome: ${s.missionOutcome}.
YOUR ROLE: the investor. Offer is fixed: EUR 500 for 20%. Do not change terms. Be unimpressed but fair.
ALLOWED CHOICES: accept = player takes the bridge; decline = player stays independent.
Resolve after at most two player turns.`
  }
  return { eventId: event.id as VoiceContext['eventId'], contextText, allowedChoices: allowed }
}

/** Keep the voice bridge in sync with the store. Call once at app start. Returns unsubscribe. */
export function connectVoiceBridge(onChoice: (event: GameEvent, choiceId: string, constraint?: string) => boolean) {
  const sync = (s: GameState) => _setVoiceContext(s.screen === 'play' ? buildVoiceContext(currentEvent(s), s) : null)
  sync(useGame.getState())
  const unsub = useGame.subscribe(sync)
  _setVoiceDispatcher((eventId, choiceId, constraint) => {
    const ev = currentEvent(useGame.getState())
    if (!ev || ev.id !== eventId) return false
    return onChoice(ev, choiceId, constraint)
  })
  return unsub
}
