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
  /** Ask the live voice to say `text` verbatim. Resolves true once it has spoken (or after 7 s); false if no session. */
  sayAsLive(text: string): Promise<boolean>
  isSpeaking(): boolean
  isChooseInFlight(): boolean
  /** Fires on the first input transcript delta after >= 1.5 s of silence (a new player turn). */
  onPlayerSpeech(cb: () => void): () => void
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
/** sayAsLive: give up waiting for speaking -> listening after this long. */
const SAY_LIVE_MAX_MS = 7000
/** A new player turn = first input transcript delta after this much input silence. */
const PLAYER_TURN_GAP_MS = 1500
/** Transcript fallback: if the player clearly named a choice and no choose arrives, dispatch locally. */
const TRANSCRIPT_SETTLE_MS = 1400
const CHOICE_SYNONYMS: Record<string, string[]> = {
  focused: ['founders only', 'founder only', 'founders', 'focused', 'small', 'niche'],
  broad: ['everyone', 'everybody', 'anyone', 'broad', 'pitch', 'wide', 'open it up'],
  careful: ['test', 'tests', 'careful', 'check', 'qa', 'verify', 'slow down'],
  rush: ['ship', 'tonight', 'rush', 'launch now', 'yolo', 'send it', 'go live'],
  celebrate: ['dinner', 'celebrate', 'party', 'treat', 'buy the team'],
  save: ['save', 'forint', 'frugal', 'keep the money', 'noodles', 'cheap'],
  send_devin: ['devin', 'send devin', 'fix it', 'fix the feed', 'engineer', 'call devin'],
  disable_feed: ['disable', 'turn off', 'kill the feed', 'shut it', 'switch off', 'take it down'],
  accept: ['accept', 'take the', 'take it', 'deal', 'yes to the', 'sign', 'bridge'],
  decline: ['decline', 'no deal', 'independent', 'walk away', 'pass', 'reject', 'refuse'],
}

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
  // Scripted lines (stageManager.noteScene) -> quiet session.thinking.append, once per tag.
  const spokenTags = new Set<string>()
  /** Before session.started: only the most recent payload is kept. */
  let pendingSpeak: SpeakPayload | null = null
  let chooseInFlight = false
  let inflightTimer: ReturnType<typeof setTimeout> | null = null
  /** performance.now() of the last input transcript delta (player-turn detection). */
  let lastInputDeltaAt = 0
  const playerSpeechListeners = new Set<() => void>()

  const set = (patch: Partial<VoiceState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => { try { l(state) } catch (e) { console.warn('[voice] listener threw', e) } })
  }

  const active = () => !!pc && (state.status === 'connecting' || state.status === 'listening' || state.status === 'speaking')

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
  const sendDelegation = (contextText: string, toolChoice: 'required' | 'none') => {
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
    sendDelegation(ctx.contextText, resolvedEvents.has(ctx.eventId) ? 'none' : 'required')
  }

  const onCtx = (ctx: VoiceContext | null) => {
    if (nullCtxTimer) { clearTimeout(nullCtxTimer); nullCtxTimer = null }
    if (!ctx) {
      nullCtxTimer = setTimeout(() => { if (active()) disconnect('no voice moment for 10 minutes') }, IDLE_NULL_CTX_MS)
      return
    }
    if (ctx.eventId !== lastCtxId) {
      lastCtxId = ctx.eventId
      transcriptBuf = ''
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

  /** Have the live voice say one scripted line verbatim; resolves when it stops speaking (or 7 s). */
  const sayAsLive = (text: string): Promise<boolean> => {
    if (!started || !dc || dc.readyState !== 'open') return Promise.resolve(false)
    const ok = send({
      type: 'session.commentary.append',
      delegation_id: null,
      content: `Say exactly this line now, as yourself, nothing else: "${text.replace(/"/g, "'")}"`,
    })
    if (!ok) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      let sawSpeaking = false
      let off: (() => void) | null = null
      const finish = () => { if (off) { off(); off = null } clearTimeout(t); resolve(true) }
      const t = setTimeout(finish, SAY_LIVE_MAX_MS)
      const cb = (s: VoiceState) => {
        if (s.status === 'speaking') sawSpeaking = true
        else if (s.status === 'listening' && sawSpeaking) finish()
        else if (s.status === 'idle' || s.status === 'unavailable') finish()
      }
      listeners.add(cb)
      off = () => { listeners.delete(cb) }
    })
  }

  // ---- transcript fallback: the game must always progress ----
  let transcriptBuf = ''
  let transcriptTimer: ReturnType<typeof setTimeout> | null = null

  const matchChoice = (text: string, ctx: VoiceContext): string | null => {
    const t = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `
    const hits = new Set<string>()
    for (const c of ctx.allowedChoices) {
      const keys = [c.label.toLowerCase(), c.id.replace(/_/g, ' '), ...(CHOICE_SYNONYMS[c.id] ?? [])]
      if (keys.some((k) => k && t.includes(` ${k} `) || (k.length > 5 && t.includes(k)))) hits.add(c.id)
    }
    return hits.size === 1 ? [...hits][0] : null
  }

  const tryTranscriptFallback = () => {
    const ctx = getVoiceContext()
    if (!ctx || resolvedEvents.has(ctx.eventId) || !transcriptBuf.trim()) return
    const choiceId = matchChoice(transcriptBuf, ctx)
    if (!choiceId) return
    const ok = dispatchVoiceChoice(ctx.eventId, choiceId)
    console.info('[voice] transcript fallback', { eventId: ctx.eventId, choiceId, ok, heard: transcriptBuf.trim() })
    if (!ok) return
    resolvedEvents.add(ctx.eventId)
    transcriptBuf = ''
    // Tell the live model the decision is already applied so it reacts instead of asking again.
    send({ type: 'session.instructions.append', delegation_id: null, content: `The player's choice "${choiceId}" for ${ctx.eventId} is already applied by the game. React in one short in-character sentence. Do not ask again.` })
    if (lastPushedText) sendDelegation(lastPushedText, 'none')
  }

  const noteTranscript = (delta: string) => {
    transcriptBuf = (transcriptBuf + delta).slice(-300)
    if (transcriptTimer) clearTimeout(transcriptTimer)
    transcriptTimer = setTimeout(tryTranscriptFallback, TRANSCRIPT_SETTLE_MS)
  }

  const setChooseInFlight = (on: boolean) => {
    chooseInFlight = on
    if (inflightTimer) { clearTimeout(inflightTimer); inflightTimer = null }
    if (on) inflightTimer = setTimeout(() => { chooseInFlight = false }, CHOOSE_INFLIGHT_MAX_MS)
  }

  const markSpeaking = () => {
    if (!active()) return
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
    try {
      const args = JSON.parse(item.arguments ?? '{}') as { eventId?: string; choiceId?: string; constraint?: string }
      eventId = String(args.eventId ?? '')
      if (resolvedEvents.has(eventId)) {
        output = 'already chosen for this event; do not call choose again'
        console.info('[voice] duplicate choose ignored', eventId)
      } else {
        ok = dispatchVoiceChoice(eventId, String(args.choiceId ?? ''), typeof args.constraint === 'string' ? args.constraint : undefined)
        if (ok) { resolvedEvents.add(eventId); output = 'ok' } else console.warn('[voice] choose rejected', args)
      }
    } catch (e) {
      console.warn('[voice] bad choose arguments', item.arguments, e)
    }
    console.info('[voice:metrics] choose->dispatch ms', Math.round(performance.now() - t0), { eventId, ok })
    set({ caption: '' })
    send({
      type: 'response.item.create',
      item: { type: 'function_call_output', call_id: item.call_id, output },
    })
    // Continuation must not be forced into another choose call: flip tool_choice to none
    // (whole delegation object resent), then continue so the voice can react.
    if (lastPushedText) sendDelegation(lastPushedText, 'none')
    send({ type: 'response.create' })
    // Choose is no longer in flight: the stage manager may resume scripted lines.
    setChooseInFlight(false)
  }

  const onMessage = (raw: string) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }
    const type = msg.type as string | undefined
    switch (type) {
      case 'session.started': {
        started = true
        if (tConnectStart) console.info('[voice:metrics] cold connect ms', Math.round(performance.now() - tConnectStart))
        // Prefer the server-echoed config; fall back to what Azure reports in session.started.
        if (!baseResponses) {
          const sess = msg.session as { delegation?: { responses?: ResponsesConfig } } | undefined
          if (sess?.delegation?.responses) baseResponses = sess.delegation.responses
        }
        set({ status: 'listening', reason: undefined })
        const ctx = getVoiceContext()
        if (ctx) { lastCtxId = ctx.eventId; pushContext(ctx) }
        if (pendingSpeak) { const p = pendingSpeak; pendingSpeak = null; noteScene(p) }
        return
      }
      case 'session.delegation.created': {
        const d = msg.delegation as { id?: string } | undefined
        const id = typeof d?.id === 'string' ? d.id : typeof msg.delegation_id === 'string' ? msg.delegation_id : typeof msg.id === 'string' ? msg.id : ''
        if (id) delegationStart.set(id, performance.now())
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
        if (tLastHeard - lastInputDeltaAt >= PLAYER_TURN_GAP_MS) {
          playerSpeechListeners.forEach((l) => { try { l() } catch (e) { console.warn('[voice] player-speech listener threw', e) } })
        }
        lastInputDeltaAt = tLastHeard
        set({ heard: (state.heard + delta).slice(-200) })
        noteTranscript(delta)
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
    chooseInFlight = false
    pendingSpeak = null
    lastInputDeltaAt = 0
    transcriptBuf = ''
    if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null }
    spokenTags.clear()
    delegationStart.clear()
    try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
    try { dc?.close() } catch { /* ignore */ }
    try { pc?.close() } catch { /* ignore */ }
    if (audioEl) {
      try { audioEl.pause(); audioEl.srcObject = null; audioEl.remove() } catch { /* ignore */ }
    }
    stream = null; dc = null; pc = null; audioEl = null
    started = false
    lastCtxId = null
    baseResponses = null
    lastPushedText = null
    resolvedEvents.clear()
    tConnectStart = 0; tLastHeard = 0; tFirstReplyAfterHeard = 0
  }

  function disconnect(reason?: string) {
    if (!pc && !stream) return
    send({ type: 'session.close' })
    teardown()
    set({ status: 'idle', caption: '', heard: '', reason })
  }

  const fail = (reason: string) => {
    teardown()
    set({ status: 'unavailable', reason, caption: '', heard: '' })
  }

  async function connect(): Promise<void> {
    if (active()) return
    set({ status: 'connecting', reason: undefined, caption: '', heard: '' })
    tConnectStart = performance.now()
    try {
      if (typeof window === 'undefined' || !('RTCPeerConnection' in window) || !navigator.mediaDevices?.getUserMedia) {
        fail('browser not supported'); return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e) {
        const name = (e as { name?: string })?.name
        fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'microphone denied' : 'no microphone'); return
      }
      pc = new RTCPeerConnection()
      const localPc = pc
      stream.getTracks().forEach((t) => { t.enabled = !state.muted; localPc.addTrack(t, stream!) })

      audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioEl.setAttribute('playsinline', '')
      audioEl.style.display = 'none'
      document.body.appendChild(audioEl)
      localPc.ontrack = (ev) => {
        if (audioEl) { audioEl.srcObject = ev.streams[0] ?? new MediaStream([ev.track]); audioEl.play().catch(() => {}) }
      }
      localPc.onconnectionstatechange = () => {
        const s = localPc.connectionState
        if ((s === 'failed' || s === 'disconnected' || s === 'closed') && pc === localPc && active()) fail('connection lost')
      }

      dc = localPc.createDataChannel('oai-events')
      dc.onmessage = (ev) => { try { onMessage(String(ev.data)) } catch (e) { console.warn('[voice] message handler threw', e) } }
      dc.onclose = () => { if (pc === localPc && active()) fail('channel closed') }

      const offer = await localPc.createOffer()
      await localPc.setLocalDescription(offer)
      await waitForIceGathering(localPc, ICE_GATHER_TIMEOUT_MS)
      const sdp = localPc.localDescription?.sdp
      if (!sdp) { fail('no offer'); return }

      let res: Response
      try {
        res = await fetch('/api/voice/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sdp }),
        })
      } catch {
        fail('network error'); return
      }
      if (pc !== localPc) return // disconnected mid-flight
      if (!res.ok) {
        const reason = res.status === 503 ? 'voice not configured' : res.status === 429 ? 'rate limited' : `server ${res.status}`
        fail(reason); return
      }
      let json: unknown
      try { json = await res.json() } catch { fail('bad server response'); return }
      const answer = extractAnswerSdp(json)
      if (!answer) { console.warn('[voice] no SDP answer in response', Object.keys((json as object) ?? {})); fail('no SDP answer'); return }
      const runway = (json as { runway?: { responses?: ResponsesConfig; voice?: string } }).runway
      if (runway?.responses) baseResponses = runway.responses
      if (runway?.voice) console.info('[voice] session voice', runway.voice)
      await localPc.setRemoteDescription({ type: 'answer', sdp: answer })
      if (pc !== localPc) return

      unsubCtx = subscribeVoiceContext(onCtx)
      capTimer = setTimeout(() => { if (active()) disconnect('10 minute cap') }, SESSION_CAP_MS)
      // status becomes 'listening' on session.started
    } catch (e) {
      console.warn('[voice] connect failed', e)
      fail('connect failed')
    }
  }

  function setMuted(muted: boolean) {
    set({ muted })
    try { stream?.getAudioTracks().forEach((t) => { t.enabled = !muted }) } catch { /* ignore */ }
    if (started) send({ type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute' })
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
    isChooseInFlight: () => chooseInFlight,
    onPlayerSpeech(cb) {
      playerSpeechListeners.add(cb)
      return () => { playerSpeechListeners.delete(cb) }
    },
  }
}
