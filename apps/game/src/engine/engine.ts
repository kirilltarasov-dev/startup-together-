/** Pure game rules from docs/SKIT.md. No rendering, no input. */
import { DISABLE_FEED_SECOND, ENDING_LINES, EVENTS, MISSION_LINES, OPENING_LINES, RESULT_LINE, WAITING_LINES } from '../events/skit.ts'
import { CAMPAIGN_EVENTS, campaignEventAt, campaignEnding } from '../events/campaign.ts'
import { applyEffects } from './effects.ts'
import { useGame } from '../state/gameStore.ts'
import { _setVoiceContext, _setVoiceDispatcher, formatLines, speakLines, type VoiceContext } from '../state/voiceBridge.ts'
import type { Choice, GameEvent, GameState, Line } from '../state/types'

export const eventSequence = (s: Pick<GameState, 'mode'>): GameEvent[] => s.mode === 'campaign' ? CAMPAIGN_EVENTS : EVENTS
export const currentEvent = (s: Pick<GameState, 'mode' | 'eventIndex' | 'flags' | 'missionOutcome'>): GameEvent | undefined => s.mode === 'campaign' ? campaignEventAt(s.eventIndex, s) : EVENTS[s.eventIndex]

/** Verified mission effects (frozen). */
export const MISSION_EFFECTS = {
  success: { health: 40, users: 50 },
  failure: { health: -15, users: -150 },
} as const

/** Ending rule: cash > 0 and health >= 50 → still in business. */
export const ending = (s: GameState) => s.mode === 'campaign' ? campaignEnding(s) : (s.cash > 0 && s.health >= 50 ? 'STILL IN BUSINESS' : 'BACK TO THE HACKATHON')

/**
 * Apply a choice exactly once. Returns false if the event was already resolved or the id is illegal.
 * Engineering choices (send_devin) are not applied here; the caller opens mission control.
 */
export function resolveChoice(event: GameEvent, choiceId: string): Choice | null {
  const g = useGame.getState()
  const active = currentEvent(g)
  if (g.resolved[event.id] || active?.id !== event.id) return null
  const choice = active.choices.find((c) => c.id === choiceId)
  if (!choice) return null
  g.set({ ...applyEffects(g, choice.effects ?? {}), resolved: { ...g.resolved, [event.id]: choice.id } })
  if (choice.reaction) {
    const lines: Line[] = [choice.reaction]
    if (choice.id === 'disable_feed') lines.push(DISABLE_FEED_SECOND)
    speakLines(lines, `${event.id}:reaction:${choice.id}`)
  }
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
YOUR ROLE: Sergio (you), reacting to Kirill's pitch. Sadman's lines are played by the game.
ALLOWED CHOICES: focused = "founders only" (small, focused); broad = "everyone with a pitch" (wide, noisy).
Sergio wants broad and a launch tweet tonight; Sadman worries about noisy data. Let the player's pitch decide.`
  } else if (event.id === 'E04') {
    contextText = `CURRENT EVENT: E04 "We went viral, the feed is dying"
GAME STATE: users ${s.users}, health ${s.health}. Production is slow.
YOUR ROLE: Sergio (you), under pressure. The player is giving orders to Devin, the AI engineer.
ALLOWED CHOICES: send_devin = ask Devin to fix the feed (real engineering);
disable_feed = turn the feed off manually (safe, loses users).
If send_devin, put any single instruction the player gave Devin into \`constraint\` (max 200 chars).`
  } else if (event.id === 'E05') {
    contextText = `CURRENT EVENT: E05 "The offer"
GAME STATE: cash ${s.cash}, users ${s.users}, health ${s.health}, ownership ${s.ownership}%. Devin outcome: ${s.missionOutcome}.
YOUR ROLE: the investor. Offer is fixed: EUR 500 for 20%. Do not change terms. Be unimpressed but fair.
ALLOWED CHOICES: accept = player takes the bridge; decline = player stays independent.
Resolve after at most two player turns.`
  } else {
    const choices = event.choices.map((c) => `${c.id} = "${c.label}"${c.hint ? ` (${c.hint})` : ''}`).join('; ')
    contextText = `CURRENT EVENT: ${event.id} "${event.title}"
GAME STATE: cash ${s.cash}, users ${s.users}, health ${s.health}, morale ${s.morale}.
YOUR ROLE: Sergio (you), cofounder reacting to Kirill. Other founders' lines are played by the game.
ALLOWED CHOICES: ${choices}.`
  }
  return { eventId: event.id, contextText, allowedChoices: allowed, linesText: formatLines(event.dialogue) }
}

/** Keep the voice bridge in sync with the store. Call once at app start. Returns unsubscribe. */
export function connectVoiceBridge(onChoice: (event: GameEvent, choiceId: string, constraint?: string) => boolean) {
  let lastScreen: GameState['screen'] | null = null
  let lastSpokenEvent: string | null = null
  let lastOutcome: GameState['missionOutcome'] = 'none'
  let resultTimer: ReturnType<typeof setTimeout> | null = null
  const sync = (s: GameState) => {
    const ev = currentEvent(s)
    _setVoiceContext(s.screen === 'play' ? buildVoiceContext(ev, s) : null)
    // Scripted lines -> voice (dedupe by tag happens in the live client).
    if (s.screen !== lastScreen) {
      if (s.screen === 'play' && lastScreen === 'opening') speakLines(OPENING_LINES, 'opening')
      if (s.screen === 'result') {
        // Result.tsx reveals the line at step 3 (~4.6s); delay so the voice roughly matches the card.
        if (resultTimer) clearTimeout(resultTimer)
        resultTimer = setTimeout(() => { if (useGame.getState().screen === 'result') speakLines([RESULT_LINE], 'result') }, 3000)
      }
      if (s.screen === 'devin') speakLines([WAITING_LINES[0]], 'waiting:0')
      if (s.screen === 'ending') {
        const win = ending(s) === 'STILL IN BUSINESS'
        speakLines([win ? ENDING_LINES.win : ENDING_LINES.lose], `ending:${win ? 'win' : 'lose'}`)
      }
      lastScreen = s.screen
    }
    if (s.missionOutcome !== lastOutcome) {
      lastOutcome = s.missionOutcome
      if (s.missionOutcome === 'success' || s.missionOutcome === 'failure') {
        speakLines(MISSION_LINES[s.missionOutcome], `mission:${s.missionOutcome}`, `VERIFIED GAME RESULT: Devin mission ${s.missionOutcome}.`)
      }
    }
    if (s.screen === 'play' && ev) {
      if (ev.id !== lastSpokenEvent) { lastSpokenEvent = ev.id; speakLines(ev.dialogue, `${ev.id}:dialogue`) }
    } else if (s.screen === 'opening') {
      lastSpokenEvent = null // restart: E01 speaks again (client dedupe set is cleared on disconnect)
    }
  }
  sync(useGame.getState())
  const unsub = useGame.subscribe(sync)
  _setVoiceDispatcher((eventId, choiceId, constraint) => {
    const ev = currentEvent(useGame.getState())
    if (!ev || ev.id !== eventId) return false
    return onChoice(ev, choiceId, constraint)
  })
  return () => { unsub(); if (resultTimer) clearTimeout(resultTimer) }
}
