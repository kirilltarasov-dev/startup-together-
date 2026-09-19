/**
 * Game <-> Voice interface. Owned by Lane A (Kirill), consumed by Lane V (Sergio).
 * Voice resolves to the SAME choice ids as buttons and goes through the same validation.
 * Do not add game logic here; this is a thin adapter over the stores.
 */

export type VoiceEventId = string

export interface VoiceContext {
  eventId: VoiceEventId
  /** Ready-made event context block (docs/VOICE.md) with live numbers filled in. Send via session.update. */
  contextText: string
  allowedChoices: { id: string; label: string }[]
  /** Scripted dialogue for the current event, one `SPEAKER: text` per line. */
  linesText?: string
}

type Listener = (ctx: VoiceContext | null) => void
type Dispatcher = (eventId: string, choiceId: string, constraint?: string) => boolean

/** Scripted lines the founders should perform aloud. `tag` is the dedupe key (e.g. `E02:dialogue`). */
export interface SpeakPayload { tag: string; text: string }
type SpeakListener = (payload: SpeakPayload) => void

let current: VoiceContext | null = null
let dispatcher: Dispatcher = () => false
const listeners = new Set<Listener>()
let lastSpeak: SpeakPayload | null = null
const speakListeners = new Set<SpeakListener>()

const SPEAKER_NAME: Record<string, string> = { kirill: 'Kirill', sadman: 'Sadman', sergio: 'Sergio' }

/** Format scripted lines as `SPEAKER: text`, one per line. */
export function formatLines(lines: { who: string; text: string }[]): string {
  return lines.map((l) => `${SPEAKER_NAME[l.who] ?? l.who}: ${l.text}`).join('\n')
}

/**
 * Ask the voice session to perform scripted lines aloud. Independent of the choice context.
 * `note` is an optional non-spoken lead line (e.g. `VERIFIED GAME RESULT: ...`).
 */
export function speakLines(lines: { who: string; text: string }[], tag: string, note?: string): void {
  if (!lines.length) return
  lastSpeak = { tag, text: (note ? `${note}\n` : '') + formatLines(lines) }
  speakListeners.forEach((l) => l(lastSpeak!))
}

/** Fires on every speakLines call; replays the most recent payload on subscribe. Returns unsubscribe. */
export function subscribeSpeak(cb: SpeakListener): () => void {
  speakListeners.add(cb)
  if (lastSpeak) cb(lastSpeak)
  return () => { speakListeners.delete(cb) }
}

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
