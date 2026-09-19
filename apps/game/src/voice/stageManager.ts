// Stage manager: the ONE serialized speech queue for RUNWAY. One speaker at a time.
// Sole subscriber of voiceBridge.subscribeSpeak. Routes each scripted line to the live Azure
// voice (Sergio / Investor when a session is up) or to local TTS (tts.ts), waits for it to finish,
// and yields to the player (barge-in) and to the live model (never talk over it).

import { subscribeSpeak, type SpeakPayload } from '../state/voiceBridge'
import { getLiveClient } from './voiceSession'
import { speakLine, ttsCancel, ttsIsMuted, ttsReset } from './tts'

const GAP_MS = 350
/** Keep the mic closed briefly after a TTS line so the speaker tail is not heard as player speech. */
const MIC_RELEASE_MS = 250
const WAIT_LIVE_SPEAKING_MAX_MS = 5000
const WAIT_CHOOSE_MAX_MS = 20_000
const POLL_MS = 100

type Line = { who: string; text: string }
interface Job { tag: string; lines: Line[] }

const queue: Job[] = []
/** Job whose lines are being played; `lines` holds only the NOT-yet-started lines. */
let current: Job | null = null
let running = false
const consumed = new Set<string>()
let unsubSpeak: (() => void) | null = null
let unsubBarge: (() => void) | null = null
/** Bumped by stageReset so an in-flight runner abandons its loop. */
let generation = 0

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function waitUntil(ok: () => boolean, maxMs: number): Promise<void> {
  const until = performance.now() + maxMs
  while (!ok() && performance.now() < until) await sleep(POLL_MS)
}

/** Live voice if a session is up (Sergio / Investor), else per-character local TTS. */
async function playLine(line: Line): Promise<void> {
  const client = getLiveClient()
  if (line.who === 'sergio' || line.who === 'investor') {
    if (await client.sayAsLive(line.text)) return
  }
  if (ttsIsMuted()) return
  // Close the mic while the speakers play a founder line; otherwise the live model hears it as the player.
  client.setMicHold(true)
  try {
    await speakLine(line.who, line.text)
    await sleep(MIC_RELEASE_MS)
  } finally {
    client.setMicHold(false)
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
        // Gate: never start a line while the live voice is talking or a choose is being routed.
        await waitUntil(() => !client.isChooseInFlight(), WAIT_CHOOSE_MAX_MS)
        await waitUntil(() => !client.isSpeaking(), WAIT_LIVE_SPEAKING_MAX_MS)
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

/** Barge-in: the player started a new turn. Cut the current line, drop the rest of its tag. */
function onPlayerSpeech(): void {
  if (!current) return
  current.lines.length = 0 // tag already in `consumed`
  ttsCancel() // resolves the pending speakLine via onerror/onend
}

/** Wire the stage manager once at app start. Returns unsubscribe. */
export function stageInit(): () => void {
  if (unsubSpeak) return () => {}
  unsubSpeak = subscribeSpeak(onPayload)
  unsubBarge = getLiveClient().onPlayerSpeech(onPlayerSpeech)
  return () => {
    unsubSpeak?.(); unsubSpeak = null
    unsubBarge?.(); unsubBarge = null
  }
}

/** Restart: stop everything, forget the queue and the dedupe tags. */
export function stageReset(): void {
  generation++
  queue.length = 0
  if (current) current.lines.length = 0
  consumed.clear()
  ttsReset()
}
