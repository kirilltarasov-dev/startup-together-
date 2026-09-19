// Stage manager: the ONE serialized speech queue for RUNWAY. One speaker at a time.
// Sole subscriber of voiceBridge.subscribeSpeak. Routes each scripted line to the live Azure
// voice (Sergio / Investor when a session is up) or to local TTS (tts.ts), waits for it to finish,
// and never talks over the live model.
//
// It also owns the CONVERSATION FLOOR (exactly one holder) and the mic-to-Azure policy that
// follows from it. The demo runs over laptop speakers, so echo is solved here, in code:
//   narrating   a scripted line (TTS or sayAsLive) is playing            -> mic to Azure CLOSED
//   processing  a choose is in flight (client.isChooseInFlight())        -> mic CLOSED
//   live_reply  Sergio is answering (live audio energy, no scripted line) -> mic OPEN (Azure AEC handles its own output)
//   listening   default                                                   -> mic OPEN
// The user's Mute always wins (liveClient.applyMic). Barge-in comes ONLY from the echo-filtered
// local ear (commandEar.ts -> stageCut) and from clicks/keys; never from Azure's input transcript.

import { subscribeSpeak, type SpeakPayload } from '../state/voiceBridge'
import { getLiveClient } from './voiceSession'
import { speakLine, ttsCancel, ttsIsMuted, ttsReset } from './tts'

const GAP_MS = 350
/** Keep the mic closed briefly after a TTS line so the speaker tail is not heard as player speech. */
const MIC_RELEASE_MS = 250
const WAIT_LIVE_SPEAKING_MAX_MS = 5000
const WAIT_CHOOSE_MAX_MS = 20_000
const POLL_MS = 100

export type Floor = 'narrating' | 'listening' | 'live_reply' | 'processing'

type Line = { who: string; text: string }
interface Job { tag: string; lines: Line[] }

const queue: Job[] = []
/** Job whose lines are being played; `lines` holds only the NOT-yet-started lines. */
let current: Job | null = null
let running = false
const consumed = new Set<string>()
let unsubSpeak: (() => void) | null = null
let floorTimer: ReturnType<typeof setInterval> | null = null
/** Bumped by stageReset so an in-flight runner abandons its loop. */
let generation = 0

// ---- floor ----
let floor: Floor = 'listening'
const floorListeners = new Set<(f: Floor) => void>()
/** True from the start of playLine until the line's audio is done (drives 'narrating'). */
let narratingLine = false
/**
 * Echo-filter reference for commandEar: the scripted line playing right now, or the last line
 * handed to the live voice (its audio lags the request by 1-2 s, so it stays after resolve).
 */
let speakingText = ''

export function getFloor(): Floor { return floor }
export function subscribeFloor(cb: (f: Floor) => void): () => void {
  floorListeners.add(cb)
  cb(floor)
  return () => { floorListeners.delete(cb) }
}
export function getCurrentlySpeakingText(): string { return speakingText }

const setFloor = (f: Floor) => {
  // Mic policy is applied on every tick (setMicHold is idempotent) so a reconnect picks it up.
  getLiveClient().setMicHold(f === 'narrating' || f === 'processing')
  if (f === floor) return
  floor = f
  floorListeners.forEach((l) => { try { l(f) } catch (e) { console.warn('[voice] floor listener threw', e) } })
}

/** Exactly one holder, priority order: narrating > processing > live_reply > listening. */
function recomputeFloor(): void {
  const client = getLiveClient()
  if (narratingLine) setFloor('narrating')
  else if (client.isChooseInFlight()) setFloor('processing')
  else if (client.isLiveSpeaking()) setFloor('live_reply')
  else setFloor('listening')
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function waitUntil(ok: () => boolean, maxMs: number): Promise<void> {
  const until = performance.now() + maxMs
  while (!ok() && performance.now() < until) await sleep(POLL_MS)
}

/** Live voice if a session is up (Sergio / Investor), else per-character local TTS. Holds the floor as 'narrating'. */
async function playLine(line: Line): Promise<void> {
  const client = getLiveClient()
  narratingLine = true
  speakingText = line.text
  recomputeFloor() // closes the mic BEFORE any audio starts
  let viaLive = false
  try {
    if (line.who === 'sergio' || line.who === 'investor') {
      viaLive = await client.sayAsLive(line.text)
      if (viaLive) return
    }
    if (ttsIsMuted()) return
    await speakLine(line.who, line.text)
    await sleep(MIC_RELEASE_MS) // speaker tail
  } finally {
    narratingLine = false
    if (!viaLive) speakingText = '' // live lines keep their text: the audio may still be in flight
    recomputeFloor()
  }
}

async function run(): Promise<void> {
  if (running) return
  running = true
  const gen = generation
  try {
    while (queue.length && gen === generation) {
      current = queue.shift()!
      while (current.lines.length && gen === generation) {
        const line = current.lines.shift()!
        const client = getLiveClient()
        // Gate: never start a line while a choose is being routed or the live voice's audio is playing.
        await waitUntil(() => !client.isChooseInFlight(), WAIT_CHOOSE_MAX_MS)
        await waitUntil(() => !client.isLiveSpeaking(), WAIT_LIVE_SPEAKING_MAX_MS)
        if (gen !== generation) break
        await playLine(line)
        if (current.lines.length || queue.length) await sleep(GAP_MS)
      }
      current = null
    }
  } finally {
    running = false
    current = null
    if (queue.length) void run() // payloads that arrived during a reset start a fresh generation
  }
}

function onPayload(p: SpeakPayload): void {
  if (consumed.has(p.tag)) return
  consumed.add(p.tag)
  const client = getLiveClient()
  client.noteScene(p) // quiet SCENE SO FAR context BEFORE the lines play
  const job: Job = { tag: p.tag, lines: p.lines.map((l) => ({ who: l.who, text: l.text })) }
  if (/:reaction:/.test(p.tag)) {
    queue.unshift(job) // reactions jump the queue: play next
  } else if (p.tag.endsWith(':dialogue')) {
    // New event: let the current line finish, drop the rest of the old tag, then this tag.
    if (current) current.lines.length = 0
    queue.push(job)
  } else {
    queue.push(job)
  }
  void run()
}

/**
 * Barge-in / skip: cut the current scripted line and drop the rest of its tag. Called by the
 * echo-filtered local ear (commandEar) and by UI actions. Returns true if anything was cut.
 * A live (sayAsLive) line cannot be stopped mid-air; its remaining tag lines are still dropped.
 */
export function stageCut(): boolean {
  const had = !!current && (current.lines.length > 0 || narratingLine)
  if (current) current.lines.length = 0 // tag already in `consumed`
  ttsCancel() // resolves the pending speakLine via onerror/onend
  return had
}

/** Wire the stage manager once at app start. Returns unsubscribe. */
export function stageInit(): () => void {
  if (unsubSpeak) return () => {}
  unsubSpeak = subscribeSpeak(onPayload)
  floorTimer = setInterval(recomputeFloor, POLL_MS)
  return () => {
    unsubSpeak?.(); unsubSpeak = null
    if (floorTimer) { clearInterval(floorTimer); floorTimer = null }
  }
}

/** Restart: stop everything, forget the queue and the dedupe tags. */
export function stageReset(): void {
  generation++
  queue.length = 0
  if (current) current.lines.length = 0
  consumed.clear()
  speakingText = ''
  ttsReset()
}
