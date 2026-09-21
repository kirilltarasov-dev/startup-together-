// Browser-side GPT-Live (Azure Foundry) WebRTC client for RUNWAY voice moments.
// Framework-free. Talks to the game ONLY through state/voiceBridge.ts.
// The browser never sees a key: it POSTs its SDP offer to same-origin /api/voice/session.
// Contract: docs/VOICE.md

import {
  dispatchVoiceChoice,
  getVoiceContext,
  subscribeVoiceContext,
  type SpeakPayload,
  type VoiceContext,
} from '../state/voiceBridge'

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'unavailable'

export interface VoiceState {
  status: VoiceStatus
  reason?: string
  /** Rolling caption of what the model said (session.output_transcript.delta). */
  caption: string
  /** Rolling transcript of what the player said (session.input_transcript.delta). */
  heard: string
  muted: boolean
}

export interface LiveClient {
  connect(): Promise<void>
  disconnect(): void
  setMuted(muted: boolean): void
  getState(): VoiceState
  subscribe(cb: (s: VoiceState) => void): () => void
  /** Quiet SCENE SO FAR context (session.thinking.append), once per tag. Buffered (latest only) before session.started. */
  noteScene(payload: SpeakPayload): void
  /** Ask the live voice to say `text` verbatim. Resolves true once its audio has played (or after 8 s); false if no session. */
  sayAsLive(text: string): Promise<boolean>
  /** UI status is 'speaking' (transcript/energy driven). Prefer isLiveSpeaking() for sequencing. */
  isSpeaking(): boolean
  /** Real audio energy on the remote track (400 ms hangover); transcript heuristic if AudioContext is unavailable. */
  isLiveSpeaking(): boolean
  isChooseInFlight(): boolean
  /** Close/open the mic to Azure (floor policy, independent of the user's Mute). */
  setMicHold(hold: boolean): void
  /** Event dedupe shared by all choice paths. */
  isResolved(eventId: string): boolean
  markResolved(eventId: string): void
  /**
   * A choice for `eventId` was dispatched outside the Azure tool path:
   * mark it resolved and tell the live model to stay silent (the scripted reaction plays instead).
   */
  noteExternalChoice(eventId: string, choiceId: string): void
}

/**
 * Complete delegation.responses config, as minted by /api/voice/session (non-secret: deployment
 * name, router prompt, tool schema, token budget, verbosity, reasoning). Azure replaces
 * `delegation` as ONE object on session.update, so we always resend it whole with only
 * `instructions` (event context appended) and `tool_choice` changed.
 */
type ResponsesConfig = Record<string, unknown> & { instructions?: string; tool_choice?: string }

const SESSION_CAP_MS = 10 * 60 * 1000
const IDLE_NULL_CTX_MS = 10 * 60 * 1000
const ICE_GATHER_TIMEOUT_MS = 1000
/** UI indicator only: how long after the last transcript delta we keep showing "speaking". Not audio speed. */
const SPEAKING_SETTLE_MS = 1200
/** Max chars of scripted-line commentary per append (keep the tail). */
const SPEAK_CAP_CHARS = 1800
/** Safety: if a delegation never yields a choose call, stop reporting it in flight after this long. */
const CHOOSE_INFLIGHT_MAX_MS = 20_000
/** Scripted lines go to the live model as QUIET context (the game plays them itself via tts.ts). */
const SPEAK_PREFIX = 'SCENE SO FAR (already spoken aloud by the game; do not repeat these lines):\n'
/** sayAsLive: give up waiting for the live audio to play and stop after this long. */
const SAY_LIVE_MAX_MS = 8000
/** Remote-track RMS (time-domain, 0..1) above which the live voice counts as speaking. Tune here. */
const LIVE_RMS_THRESHOLD = 0.015
/** Keep "speaking" this long after the last loud frame (pauses between words, 100 ms poll jitter). */
const LIVE_HANGOVER_MS = 400
const LIVE_POLL_MS = 100
/** Message appended when a choice was applied outside the Azure tool path (local ear / fallback). */
const SILENT_AFTER_CHOICE = (choiceId: string) => `The player already chose "${choiceId}". Stay silent unless the player speaks to you again.`

let eventCounter = 0
const nextEventId = () => `evt_${Date.now().toString(36)}_${(++eventCounter).toString(36)}`

/** Find the SDP answer wherever Azure put it in the response JSON. */
function extractAnswerSdp(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Record<string, unknown>
  const direct = j.sdp
  if (typeof direct === 'string' && direct.startsWith('v=0')) return direct
  const transport = j.transport as Record<string, unknown> | undefined
  if (transport && typeof transport.sdp === 'string') return transport.sdp
  const answer = j.answer as Record<string, unknown> | undefined
  if (answer && typeof answer.sdp === 'string') return answer.sdp
  // Fallback: any nested string value beginning with "v=0".
  const stack: unknown[] = [json]
  let guard = 0
  while (stack.length && guard++ < 500) {
    const cur = stack.pop()
    if (typeof cur === 'string') { if (cur.startsWith('v=0')) return cur; continue }
    if (cur && typeof cur === 'object') stack.push(...Object.values(cur as Record<string, unknown>))
  }
  return null
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => { pc.removeEventListener('icegatheringstatechange', check); clearTimeout(t); resolve() }
    const check = () => { if (pc.iceGatheringState === 'complete') done() }
    const t = setTimeout(done, timeoutMs)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

export function createLiveClient(): LiveClient {
  let state: VoiceState = { status: 'idle', caption: '', heard: '', muted: false }
  const listeners = new Set<(s: VoiceState) => void>()

  let pc: RTCPeerConnection | null = null
  let dc: RTCDataChannel | null = null
  let stream: MediaStream | null = null
  let audioEl: HTMLAudioElement | null = null
  let connectionGeneration = 0
  let connectPromise: Promise<void> | null = null
  let started = false
  let unsubCtx: (() => void) | null = null
  let capTimer: ReturnType<typeof setTimeout> | null = null
  let nullCtxTimer: ReturnType<typeof setTimeout> | null = null
  let speakTimer: ReturnType<typeof setTimeout> | null = null
  let lastCtxId: string | null = null
  /** Full delegation.responses from the server; null until the session response arrives. */
  let baseResponses: ResponsesConfig | null = null
  /** Dedupe: last context text pushed to the session. engine.ts re-syncs on every store change. */
  let lastPushedText: string | null = null
  /** Events already resolved by a choose call; repeat calls are acknowledged but not dispatched. */
  const resolvedEvents = new Set<string>()
  // Latency probes (console only). Separate: cold connect, speech->first reply, delegation->choose, choose->dispatch.
  let tConnectStart = 0
  let tLastHeard = 0
  let tFirstReplyAfterHeard = 0
  /** performance.now() when session.delegation.created arrived, by delegation id. */
  const delegationStart = new Map<string, number>()
  /** Whether the mic was open when this delegation started. A later processing hold is expected. */
  const delegationInputAllowed = new Map<string, boolean>()
  let lastDelegationInputAllowed = true
  // Scripted lines (stageManager.noteScene) -> quiet session.thinking.append, once per tag.
  const spokenTags = new Set<string>()
  /** Before session.started: only the most recent payload is kept. */
  let pendingSpeak: SpeakPayload | null = null
  let chooseInFlight = false
  let inflightTimer: ReturnType<typeof setTimeout> | null = null
  // Real live-speech detection: AnalyserNode on the remote track (created once per connection in ontrack).
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let energyTimer: ReturnType<typeof setInterval> | null = null
  let liveAudioActive = false
  /** performance.now() of the last frame above LIVE_RMS_THRESHOLD. */
  let lastLoudAt = 0
  /** Cancellation-aware completion callbacks for sayAsLive's local waiters. */
  const sayWaiters = new Set<(completed: boolean) => void>()

  const set = (patch: Partial<VoiceState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => { try { l(state) } catch (e) { console.warn('[voice] listener threw', e) } })
  }

  const active = () => !!pc && (state.status === 'connecting' || state.status === 'listening' || state.status === 'speaking')

  const energyAvailable = () => analyser !== null
  /** Speaking = loud frame within the hangover window. Falls back to the transcript-driven UI status. */
  const isLiveSpeaking = () => energyAvailable()
    ? liveAudioActive || performance.now() - lastLoudAt < LIVE_HANGOVER_MS
    : state.status === 'speaking'

  /** Start metering the remote track. Never throws; on failure we keep the transcript heuristic. */
  const startEnergyMeter = (remote: MediaStream) => {
    if (analyser || typeof window === 'undefined') return
    const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) { console.info('[voice] AudioContext unavailable; live speech detection uses transcript heuristic'); return }
    try {
      audioCtx = new Ctor()
      const src = audioCtx.createMediaStreamSource(remote)
      const an = audioCtx.createAnalyser()
      an.fftSize = 512
      src.connect(an) // analysis only: not connected to destination (the <audio> element plays the track)
      analyser = an
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
      const buf = new Float32Array(an.fftSize)
      energyTimer = setInterval(() => {
        if (!analyser) return
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        const now = performance.now()
        if (rms > LIVE_RMS_THRESHOLD) { lastLoudAt = now; liveAudioActive = true }
        else if (now - lastLoudAt >= LIVE_HANGOVER_MS) liveAudioActive = false
        // UI status follows real audio when the meter is available.
        if (liveAudioActive && state.status === 'listening') set({ status: 'speaking' })
        else if (!liveAudioActive && state.status === 'speaking') set({ status: 'listening' })
      }, LIVE_POLL_MS)
    } catch (e) {
      console.warn('[voice] energy meter failed; using transcript heuristic', e)
      analyser = null
      try { audioCtx?.close() } catch { /* ignore */ }
      audioCtx = null
    }
  }

  const stopEnergyMeter = () => {
    if (energyTimer) { clearInterval(energyTimer); energyTimer = null }
    analyser = null
    liveAudioActive = false
    lastLoudAt = 0
    if (audioCtx) { try { void audioCtx.close() } catch { /* ignore */ } audioCtx = null }
  }

  const send = (payload: Record<string, unknown>): boolean => {
    try {
      if (!dc || dc.readyState !== 'open') return false
      dc.send(JSON.stringify({ event_id: nextEventId(), ...payload }))
      return true
    } catch (e) {
      console.warn('[voice] send failed', payload.type, e)
      return false
    }
  }

  /** Resend the complete delegation.responses with event context appended and the given tool_choice. */
  const sendDelegation = (contextText: string, toolChoice: 'auto' | 'none') => {
    if (!baseResponses) return false
    const base = typeof baseResponses.instructions === 'string' ? baseResponses.instructions : ''
    return send({
      type: 'session.update',
      session: {
        delegation: {
          type: 'responses',
          responses: { ...baseResponses, instructions: `${base}\n\n${contextText}`, tool_choice: toolChoice },
        },
      },
    })
  }

  const pushContext = (ctx: VoiceContext) => {
    if (!started) return
    if (ctx.contextText === lastPushedText) return
    lastPushedText = ctx.contextText
    send({ type: 'session.instructions.append', delegation_id: null, content: ctx.contextText })
    sendDelegation(ctx.contextText, resolvedEvents.has(ctx.eventId) ? 'none' : 'auto')
  }

  const onCtx = (ctx: VoiceContext | null) => {
    if (nullCtxTimer) { clearTimeout(nullCtxTimer); nullCtxTimer = null }
    if (!ctx) {
      if (started && lastPushedText) sendDelegation(lastPushedText, 'none')
      lastPushedText = null
      nullCtxTimer = setTimeout(() => { if (active()) disconnect('no voice moment for 10 minutes') }, IDLE_NULL_CTX_MS)
      return
    }
    if (ctx.eventId !== lastCtxId) {
      lastCtxId = ctx.eventId
      set({ caption: '', heard: '' })
    }
    pushContext(ctx)
  }

  /** Keep the last lines that fit under the cap (never cut a line in half). */
  const capLines = (text: string): string => {
    if (text.length <= SPEAK_CAP_CHARS) return text
    const lines = text.split('\n')
    const kept: string[] = []
    let len = 0
    for (let i = lines.length - 1; i >= 0; i--) {
      const add = lines[i].length + (kept.length ? 1 : 0)
      if (len + add > SPEAK_CAP_CHARS) break
      kept.unshift(lines[i]); len += add
    }
    return kept.length ? kept.join('\n') : text.slice(-SPEAK_CAP_CHARS)
  }

  const noteScene = (p: SpeakPayload) => {
    if (!started) { pendingSpeak = p; return }
    if (spokenTags.has(p.tag)) return
    spokenTags.add(p.tag)
    // Quiet context only: audible playback is sequenced by stageManager.ts (TTS or sayAsLive).
    send({ type: 'session.thinking.append', delegation_id: null, content: SPEAK_PREFIX + capLines(p.text) })
  }

  /**
   * Have the live voice say one scripted line verbatim. Resolves when its AUDIO has played: energy
   * went active at least once and then quiet for LIVE_HANGOVER_MS (or SAY_LIVE_MAX_MS). Without an
   * AudioContext, falls back to the transcript-driven status (which leads the audio by 1-2 s).
   */
  const sayAsLive = (text: string): Promise<boolean> => {
    if (state.muted || !started || !dc || dc.readyState !== 'open') return Promise.resolve(false)
    const ok = send({
      type: 'session.commentary.append',
      delegation_id: null,
      // Bare line only: commentary is "information the model should say aloud"; any wrapper text risks being read out.
      content: text,
    })
    if (!ok) return Promise.resolve(false)
    if (energyAvailable()) {
      return new Promise<boolean>((resolve) => {
        let sawActive = false
        const t0 = performance.now()
        let done = false
        const finish = (completed: boolean) => {
          if (done) return
          done = true
          clearInterval(iv)
          sayWaiters.delete(finish)
          resolve(completed)
        }
        const iv = setInterval(() => {
          const now = performance.now()
          if (liveAudioActive) sawActive = true
          const quietAfterSpeech = sawActive && !liveAudioActive && now - lastLoudAt >= LIVE_HANGOVER_MS
          if (quietAfterSpeech || now - t0 >= SAY_LIVE_MAX_MS) finish(true)
        }, LIVE_POLL_MS)
        sayWaiters.add(finish)
      })
    }
    return new Promise<boolean>((resolve) => {
      let sawSpeaking = false
      let done = false
      const finish = (completed: boolean) => {
        if (done) return
        done = true
        listeners.delete(cb)
        clearTimeout(t)
        sayWaiters.delete(finish)
        resolve(completed)
      }
      const t = setTimeout(() => finish(true), SAY_LIVE_MAX_MS)
      const cb = (s: VoiceState) => {
        if (s.status === 'speaking') sawSpeaking = true
        else if (s.status === 'listening' && sawSpeaking) finish(true)
      }
      listeners.add(cb)
      sayWaiters.add(finish)
    })
  }

  /** Shared with commandEar: a choice was applied outside the tool path -> silence the live model. */
  const noteExternalChoice = (eventId: string, choiceId: string) => {
    resolvedEvents.add(eventId)
    send({ type: 'session.instructions.append', delegation_id: null, content: SILENT_AFTER_CHOICE(choiceId) })
    if (lastPushedText) sendDelegation(lastPushedText, 'none')
  }

  const setChooseInFlight = (on: boolean) => {
    chooseInFlight = on
    if (inflightTimer) { clearTimeout(inflightTimer); inflightTimer = null }
    if (on) inflightTimer = setTimeout(() => { chooseInFlight = false }, CHOOSE_INFLIGHT_MAX_MS)
  }

  /** Transcript-driven "speaking" UI status; only used when the energy meter is unavailable. */
  const markSpeaking = () => {
    if (!active() || energyAvailable()) return
    if (state.status !== 'speaking') set({ status: 'speaking' })
    if (speakTimer) clearTimeout(speakTimer)
    speakTimer = setTimeout(() => { if (state.status === 'speaking') set({ status: 'listening' }) }, SPEAKING_SETTLE_MS)
  }

  const handleToolCall = (item: { call_id?: string; arguments?: string }, delegationId?: string) => {
    const t0 = performance.now()
    if (delegationId && delegationStart.has(delegationId)) {
      console.info('[voice:metrics] delegation->choose ms', Math.round(t0 - delegationStart.get(delegationId)!), { delegationId })
      delegationStart.delete(delegationId)
    }
    let ok = false
    let output = 'rejected: illegal or stale choice'
    let eventId = ''
    let choiceId = ''
    try {
      const args = JSON.parse(item.arguments ?? '{}') as { eventId?: string; choiceId?: string; constraint?: string }
      eventId = String(args.eventId ?? '')
      choiceId = String(args.choiceId ?? '')
      const inputWasAllowed = delegationId
        ? delegationInputAllowed.get(delegationId) ?? lastDelegationInputAllowed
        : lastDelegationInputAllowed
      if (state.muted) {
        output = 'rejected: microphone muted'
        console.info('[voice] choose ignored while muted', eventId)
      } else if (!inputWasAllowed) {
        output = 'rejected: microphone was held when this delegation started'
        console.info('[voice] choose ignored from held input', eventId)
      } else if (resolvedEvents.has(eventId)) {
        output = 'already chosen for this event; do not call choose again'
        console.info('[voice] duplicate choose ignored', eventId)
      } else {
        ok = dispatchVoiceChoice(eventId, choiceId, typeof args.constraint === 'string' ? args.constraint : undefined)
        if (ok) { resolvedEvents.add(eventId); output = 'ok' } else console.warn('[voice] choose rejected', args)
        console.info('[voice] command', { source: 'azure', eventId, choiceId, ok, heard: state.heard })
      }
    } catch (e) {
      console.warn('[voice] bad choose arguments', item.arguments, e)
    }
    if (delegationId) delegationInputAllowed.delete(delegationId)
    console.info('[voice:metrics] choose->dispatch ms', Math.round(performance.now() - t0), { eventId, ok })
    set({ caption: '' })
    send({
      type: 'response.item.create',
      item: { type: 'function_call_output', call_id: item.call_id, output },
    })
    if (ok || resolvedEvents.has(eventId)) {
      // A valid choice (or a known duplicate) disarms the router. Rejections leave the active
      // event on auto so a later valid tool result can still resolve it.
      if (lastPushedText) sendDelegation(lastPushedText, 'none')
    }
    // Choose is no longer in flight: the stage manager may resume scripted lines.
    setChooseInFlight(false)
  }

  const onMessage = (raw: string, localPc: RTCPeerConnection) => {
    if (pc !== localPc) return
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }
    const type = msg.type as string | undefined
    switch (type) {
      case 'session.started': {
        if (pc !== localPc) return
        started = true
        if (tConnectStart) console.info('[voice:metrics] cold connect ms', Math.round(performance.now() - tConnectStart))
        // Prefer the server-echoed config; fall back to what Azure reports in session.started.
        if (!baseResponses) {
          const sess = msg.session as { delegation?: { responses?: ResponsesConfig } } | undefined
          if (sess?.delegation?.responses) baseResponses = sess.delegation.responses
        }
        set({ status: 'listening', reason: undefined })
        applyMic()
        const ctx = getVoiceContext()
        if (ctx) { lastCtxId = ctx.eventId; pushContext(ctx) }
        if (pendingSpeak) { const p = pendingSpeak; pendingSpeak = null; noteScene(p) }
        return
      }
      case 'session.delegation.created': {
        const d = msg.delegation as { id?: string } | undefined
        const id = typeof d?.id === 'string' ? d.id : typeof msg.delegation_id === 'string' ? msg.delegation_id : typeof msg.id === 'string' ? msg.id : ''
        lastDelegationInputAllowed = !state.muted && !micHeld
        if (id) {
          delegationStart.set(id, performance.now())
          delegationInputAllowed.set(id, lastDelegationInputAllowed)
        }
        setChooseInFlight(true)
        return
      }
      case 'session.output_transcript.delta': {
        const delta = typeof msg.delta === 'string' ? msg.delta : ''
        if (tLastHeard && !tFirstReplyAfterHeard) {
          tFirstReplyAfterHeard = performance.now()
          console.info('[voice:metrics] speech->first reply transcript ms', Math.round(tFirstReplyAfterHeard - tLastHeard))
        }
        set({ caption: (state.caption + delta).slice(-400) })
        markSpeaking()
        return
      }
      case 'session.input_transcript.delta': {
        const delta = typeof msg.delta === 'string' ? msg.delta : ''
        tLastHeard = performance.now(); tFirstReplyAfterHeard = 0
        // No barge-in from this transcript: over speakers it carried echo of our own TTS / Sergio.
        // Interruptions come from the echo-filtered local ear (commandEar.ts) and from clicks only.
        set({ heard: (state.heard + delta).slice(-200) })
        return
      }
      case 'response.event': {
        const ev = (msg.event ?? {}) as Record<string, unknown>
        if (ev.type === 'response.output_item.done') {
          const item = ev.item as { type?: string; name?: string; call_id?: string; arguments?: string } | undefined
          if (item?.type === 'function_call' && item.name === 'choose') {
            handleToolCall(item, typeof msg.delegation_id === 'string' ? msg.delegation_id : undefined)
          }
        }
        return
      }
      case 'session.closed': {
        console.info('[voice] session.closed', msg.usage ?? msg)
        teardown()
        set({ status: 'idle', caption: '', heard: '' })
        return
      }
      case 'error': {
        console.warn('[voice] server error event', msg)
        const err = (msg.error ?? msg) as Record<string, unknown>
        const short = typeof err.message === 'string' ? err.message : 'voice error'
        set({ caption: `(${short.slice(0, 80)})` })
        return
      }
      default:
        return
    }
  }

  function teardown() {
    if (capTimer) { clearTimeout(capTimer); capTimer = null }
    if (nullCtxTimer) { clearTimeout(nullCtxTimer); nullCtxTimer = null }
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null }
    if (unsubCtx) { unsubCtx(); unsubCtx = null }
    if (inflightTimer) { clearTimeout(inflightTimer); inflightTimer = null }
    for (const finish of [...sayWaiters]) finish(false)
    chooseInFlight = false
    pendingSpeak = null
    stopEnergyMeter()
    spokenTags.clear()
    delegationStart.clear()
    delegationInputAllowed.clear()
    lastDelegationInputAllowed = true
    const localStream = stream
    const localDc = dc
    const localPc = pc
    const localAudioEl = audioEl
    stream = null; dc = null; pc = null; audioEl = null
    started = false
    lastCtxId = null
    baseResponses = null
    lastPushedText = null
    resolvedEvents.clear()
    tConnectStart = 0; tLastHeard = 0; tFirstReplyAfterHeard = 0
    try { localStream?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
    try { localDc?.close() } catch { /* ignore */ }
    try { localPc?.close() } catch { /* ignore */ }
    if (localAudioEl) {
      try { localAudioEl.pause(); localAudioEl.srcObject = null; localAudioEl.remove() } catch { /* ignore */ }
    }
  }

  function disconnect(reason?: string) {
    if (!connectPromise && !pc && !stream) return
    connectionGeneration++
    connectPromise = null
    send({ type: 'session.close' })
    teardown()
    set({ status: 'idle', caption: '', heard: '', reason })
  }

  const fail = (reason: string, attempt = connectionGeneration) => {
    if (attempt !== connectionGeneration) return
    connectPromise = null
    teardown()
    set({ status: 'unavailable', reason, caption: '', heard: '' })
  }

  const currentAttempt = (attempt: number, localPc?: RTCPeerConnection) =>
    connectionGeneration === attempt && (!localPc || pc === localPc)

  function connect(): Promise<void> {
    if (connectPromise) return connectPromise
    if (active()) return Promise.resolve()
    const attempt = ++connectionGeneration
    const pending = Promise.resolve().then(() => connectAttempt(attempt))
    connectPromise = pending
    return pending
  }

  async function connectAttempt(attempt: number): Promise<void> {
    if (!currentAttempt(attempt)) return
    set({ status: 'connecting', reason: undefined, caption: '', heard: '' })
    tConnectStart = performance.now()
    try {
      if (typeof window === 'undefined' || !('RTCPeerConnection' in window) || !navigator.mediaDevices?.getUserMedia) {
        fail('browser not supported', attempt); return
      }
      let localStream: MediaStream
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e) {
        const name = (e as { name?: string })?.name
        fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'microphone denied' : 'no microphone', attempt); return
      }
      if (!currentAttempt(attempt)) {
        try { localStream.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
        return
      }
      stream = localStream
      const localPc = new RTCPeerConnection()
      pc = localPc
      localStream.getTracks().forEach((t) => {
        t.enabled = !state.muted && !micHeld
        localPc.addTrack(t, localStream)
      })

      const localAudioEl = document.createElement('audio')
      audioEl = localAudioEl
      localAudioEl.autoplay = true
      localAudioEl.muted = state.muted
      localAudioEl.setAttribute('playsinline', '')
      localAudioEl.style.display = 'none'
      document.body.appendChild(localAudioEl)
      localPc.ontrack = (ev) => {
        if (!currentAttempt(attempt, localPc) || audioEl !== localAudioEl) return
        const remote = ev.streams[0] ?? new MediaStream([ev.track])
        localAudioEl.srcObject = remote
        localAudioEl.play().catch(() => {})
        // connect() runs from the Talk click, so the AudioContext is allowed to run. Once per connection.
        startEnergyMeter(remote)
      }
      localPc.onconnectionstatechange = () => {
        const s = localPc.connectionState
        if ((s === 'failed' || s === 'disconnected' || s === 'closed') && currentAttempt(attempt, localPc) && active()) {
          fail('connection lost', attempt)
        }
      }

      dc = localPc.createDataChannel('oai-events')
      dc.onmessage = (ev) => {
        try { onMessage(String(ev.data), localPc) } catch (e) { console.warn('[voice] message handler threw', e) }
      }
      dc.onclose = () => {
        if (currentAttempt(attempt, localPc) && active()) fail('channel closed', attempt)
      }

      const offer = await localPc.createOffer()
      if (!currentAttempt(attempt, localPc)) return
      await localPc.setLocalDescription(offer)
      await waitForIceGathering(localPc, ICE_GATHER_TIMEOUT_MS)
      if (!currentAttempt(attempt, localPc)) return
      const sdp = localPc.localDescription?.sdp
      if (!sdp) { fail('no offer', attempt); return }

      let res: Response
      try {
        res = await fetch('/api/voice/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sdp }),
        })
      } catch {
        fail('network error', attempt); return
      }
      if (!currentAttempt(attempt, localPc)) return
      if (!res.ok) {
        const reason = res.status === 503 ? 'voice not configured' : res.status === 429 ? 'rate limited' : `server ${res.status}`
        fail(reason, attempt); return
      }
      let json: unknown
      try { json = await res.json() } catch { fail('bad server response', attempt); return }
      if (!currentAttempt(attempt, localPc)) return
      const answer = extractAnswerSdp(json)
      if (!answer) {
        console.warn('[voice] no SDP answer in response', Object.keys((json as object) ?? {}))
        fail('no SDP answer', attempt)
        return
      }
      const runway = (json as { runway?: { responses?: ResponsesConfig; voice?: string } }).runway
      if (runway?.responses) baseResponses = runway.responses
      if (runway?.voice) console.info('[voice] session voice', runway.voice)
      await localPc.setRemoteDescription({ type: 'answer', sdp: answer })
      if (!currentAttempt(attempt, localPc)) return

      unsubCtx = subscribeVoiceContext((ctx) => {
        if (currentAttempt(attempt, localPc)) onCtx(ctx)
      })
      capTimer = setTimeout(() => {
        if (currentAttempt(attempt, localPc) && active()) disconnect('10 minute cap')
      }, SESSION_CAP_MS)
      // status becomes 'listening' on session.started
    } catch (e) {
      console.warn('[voice] connect failed', e)
      fail('connect failed', attempt)
    } finally {
      if (connectionGeneration === attempt) connectPromise = null
    }
  }

  let micHeld = false
  const applyMic = () => {
    const on = !state.muted && !micHeld
    try { stream?.getAudioTracks().forEach((t) => { t.enabled = on }) } catch { /* ignore */ }
    if (started) send({ type: on ? 'session.input_audio.unmute' : 'session.input_audio.mute' })
  }

  function setMuted(muted: boolean) {
    set({ muted })
    if (audioEl) audioEl.muted = muted
    if (muted) for (const finish of [...sayWaiters]) finish(false)
    applyMic()
  }

  /** Floor policy (stageManager): close the mic while scripted lines play or a choose is routed. */
  function setMicHold(hold: boolean) {
    if (micHeld === hold) return
    micHeld = hold
    applyMic()
  }

  return {
    connect,
    disconnect: () => disconnect(),
    setMuted,
    getState: () => state,
    subscribe(cb) {
      listeners.add(cb)
      cb(state)
      return () => { listeners.delete(cb) }
    },
    noteScene,
    sayAsLive,
    isSpeaking: () => state.status === 'speaking',
    isLiveSpeaking,
    isChooseInFlight: () => chooseInFlight,
    setMicHold,
    isResolved: (eventId) => resolvedEvents.has(eventId),
    markResolved: (eventId) => { resolvedEvents.add(eventId) },
    noteExternalChoice,
  }
}
