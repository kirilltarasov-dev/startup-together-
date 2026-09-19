// Always-on LOCAL command layer (Web Speech API SpeechRecognition, Chrome). Runs in EVERY floor
// state while a live session is up, so the player can rush ("continue", "skip") or name a choice
// even while the mic to Azure is closed for narration. Echo-filtered against the line currently
// playing over the speakers (stageManager.getCurrentlySpeakingText + the live caption), because
// the demo runs over laptop speakers and SpeechRecognition hears our own TTS / Sergio.
//
// Imports: voiceBridge + choiceMatch + stageManager getters + voiceSession. Nothing imports this
// module except index.ts / App.tsx (init), so there is no import cycle.

import { dispatchVoiceChoice, getVoiceContext } from '../state/voiceBridge'
import { isContinueCommand, matchChoice, normalizeText, tokenOverlap } from './choiceMatch'
import { getCurrentlySpeakingText, getFloor, stageCut } from './stageManager'
import { getLiveClient } from './voiceSession'

/** Ignore a recognition result when at least this fraction of its tokens are in the line playing now. */
const ECHO_OVERLAP = 0.6
/** Act at most once per eventId (or per cut) in this window: interim + final results repeat the same phrase. */
const DEBOUNCE_MS = 1200
const RESTART_DELAY_MS = 250

// Minimal Web Speech typings (not in lib.dom for the prefixed constructor).
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; length: number; [i: number]: SRAlternative }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string; message?: string }
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((ev: SREvent) => void) | null
  onend: (() => void) | null
  onerror: ((ev: SRErrorEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SRCtor = new () => SpeechRecognitionLike

function getCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

let rec: SpeechRecognitionLike | null = null
let wanted = false // session active: keep the recognizer running (restart on end)
let restartTimer: ReturnType<typeof setTimeout> | null = null
let unsubClient: (() => void) | null = null
let loggedUnavailable = false
const lastActAt = new Map<string, number>()

const debounced = (key: string): boolean => {
  const now = performance.now()
  const last = lastActAt.get(key) ?? 0
  if (now - last < DEBOUNCE_MS) return true
  lastActAt.set(key, now)
  return false
}

/** Cut narration: ttsCancel() the utterance and drop the remaining lines of the current tag. */
const cutNarration = () => { stageCut() }

/** One recognized phrase (interim or final). Exported for the console / tests; never throws. */
export function handleHeard(raw: string): void {
  const heard = normalizeText(raw)
  if (!heard) return
  const client = getLiveClient()
  // ECHO FILTER: our own speakers (scripted line playing now / last live line, or Sergio's live caption).
  const ref = `${getCurrentlySpeakingText()} ${client.getState().caption}`
  const overlap = tokenOverlap(heard, ref)
  if (overlap >= ECHO_OVERLAP) return

  const ctx = getVoiceContext()
  const floor = getFloor()

  // (1) continue / skip words.
  if (isContinueCommand(heard)) {
    if (ctx && ctx.eventId.endsWith(':continue')) {
      if (client.isResolved(ctx.eventId) || debounced(ctx.eventId)) return
      const ok = dispatchVoiceChoice(ctx.eventId, 'continue')
      console.info('[voice] command', { source: 'local', eventId: ctx.eventId, choiceId: 'continue', ok, heard })
      if (ok) { client.noteExternalChoice(ctx.eventId, 'continue'); cutNarration() }
      return
    }
    if (floor === 'narrating') {
      if (debounced('cut')) return
      console.info('[voice] command', { source: 'local', eventId: ctx?.eventId ?? null, choiceId: null, heard, action: 'cut' })
      cutNarration()
    }
    return
  }

  // (2) a choice of the active context (unique match only).
  if (!ctx || client.isResolved(ctx.eventId)) return
  const choiceId = matchChoice(heard, ctx.allowedChoices)
  if (!choiceId) return
  if (debounced(ctx.eventId)) return
  const ok = dispatchVoiceChoice(ctx.eventId, choiceId)
  console.info('[voice] command', { source: 'local', eventId: ctx.eventId, choiceId, ok, heard })
  if (!ok) return
  client.noteExternalChoice(ctx.eventId, choiceId)
  if (floor === 'narrating') cutNarration()
}

function startRecognizer(): void {
  if (rec || !wanted) return
  const Ctor = getCtor()
  if (!Ctor) return
  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-US'
  r.maxAlternatives = 1
  r.onresult = (ev) => {
    try {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        const alt = res?.[0]
        if (alt?.transcript) handleHeard(alt.transcript)
      }
    } catch (e) {
      console.warn('[voice] command ear result handler threw', e)
    }
  }
  r.onerror = (ev) => {
    // 'no-speech' / 'aborted' / 'network' are routine; onend follows and we restart.
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      console.warn('[voice] command ear disabled:', ev.error)
      wanted = false
    } else if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
      console.info('[voice] command ear error', ev.error)
    }
  }
  r.onend = () => {
    if (rec === r) rec = null
    if (!wanted) return
    if (restartTimer) clearTimeout(restartTimer)
    restartTimer = setTimeout(() => { restartTimer = null; startRecognizer() }, RESTART_DELAY_MS)
  }
  try {
    r.start()
    rec = r
    console.info('[voice] command ear listening (local SpeechRecognition)')
  } catch (e) {
    // "already started" / not-allowed: never crash; the Azure path, fallback and buttons still work.
    console.warn('[voice] command ear start failed', e)
    rec = null
  }
}

function stopRecognizer(): void {
  wanted = false
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
  const r = rec
  rec = null
  if (r) { r.onend = null; r.onresult = null; r.onerror = null; try { r.abort() } catch { /* ignore */ } }
  lastActAt.clear()
}

/**
 * Wire once at app start: the ear runs while the live client is connected (mic permission is
 * already granted by then) and stops on disconnect/teardown. Returns unsubscribe.
 */
export function initCommandEar(): () => void {
  if (unsubClient) return () => {}
  if (!getCtor()) {
    if (!loggedUnavailable) {
      loggedUnavailable = true
      console.info('[voice] SpeechRecognition unavailable; relying on Azure + transcript fallback + buttons')
    }
    return () => {}
  }
  unsubClient = getLiveClient().subscribe((s) => {
    const connected = s.status === 'listening' || s.status === 'speaking'
    if (connected && !wanted) { wanted = true; startRecognizer() }
    else if (!connected && s.status !== 'connecting' && wanted) stopRecognizer()
  })
  return () => { unsubClient?.(); unsubClient = null; stopRecognizer() }
}

export function isCommandEarActive(): boolean { return rec !== null }
