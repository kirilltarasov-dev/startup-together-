/**
 * Game <-> Voice interface. Owned by Lane A (Kirill), consumed by Lane V (Sergio).
 * Voice resolves to the SAME choice ids as buttons and goes through the same validation.
 * Do not add game logic here; this is a thin adapter over the stores.
 */

export type VoiceEventId = 'E01' | 'E04' | 'E05'

export interface VoiceContext {
  eventId: VoiceEventId
  /** Ready-made event context block (docs/VOICE.md) with live numbers filled in. Send via session.update. */
  contextText: string
  allowedChoices: { id: string; label: string }[]
}

type Listener = (ctx: VoiceContext | null) => void
type Dispatcher = (eventId: string, choiceId: string, constraint?: string) => boolean

let current: VoiceContext | null = null
let dispatcher: Dispatcher = () => false
const listeners = new Set<Listener>()

/** Current voice-enabled event, or null when no voice moment is active. */
export function getVoiceContext(): VoiceContext | null {
  return current
}

/** Fires whenever the active voice context changes (including to null). Returns unsubscribe. */
export function subscribeVoiceContext(cb: Listener): () => void {
  listeners.add(cb)
  cb(current)
  return () => { listeners.delete(cb) }
}

/** Apply a voice-resolved choice. Returns false if the event is stale or the choice id is illegal. */
export function dispatchVoiceChoice(eventId: string, choiceId: string, constraint?: string): boolean {
  if (!current || current.eventId !== eventId) { console.warn('[voice] stale event', eventId); return false }
  if (!current.allowedChoices.some((c) => c.id === choiceId)) { console.warn('[voice] illegal choice', choiceId); return false }
  return dispatcher(eventId, choiceId, sanitizeConstraint(constraint))
}

export function sanitizeConstraint(raw?: string): string | undefined {
  if (!raw) return undefined
  let s = raw.replace(/[\r\n`]/g, ' ').replace(/https?:\/\/\S+/gi, '').trim().slice(0, 200)
  if (/\b(rm |curl|sudo|git push|token|key)\b/i.test(s)) return undefined
  return s || undefined
}

// ---- internal: called by the game (Lane A) ----
export function _setVoiceContext(ctx: VoiceContext | null) {
  current = ctx
  listeners.forEach((l) => l(ctx))
}
export function _setVoiceDispatcher(d: Dispatcher) {
  dispatcher = d
}
