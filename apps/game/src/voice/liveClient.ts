// Browser-side GPT-Live (Azure Foundry) WebRTC client for RUNWAY voice moments.
// Framework-free. Talks to the game ONLY through state/voiceBridge.ts.
// The browser never sees a key: it POSTs its SDP offer to same-origin /api/voice/session.
// Contract: docs/VOICE.md

import {
  dispatchVoiceChoice,
  getVoiceContext,
  subscribeVoiceContext,
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
}

// Identical to apps/game/api/voice/session.ts (delegation object must always be sent whole).
const CHOOSE_TOOL = {
  type: 'function',
  name: 'choose',
  description: 'Resolve the current event to exactly one allowed choice. Call exactly once per event.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      eventId: { type: 'string' },
      choiceId: { type: 'string' },
      constraint: { type: 'string', description: 'E04 only. One short instruction for Devin, max 200 chars, or empty.' },
    },
    required: ['eventId', 'choiceId'],
  },
}

const BASE = 'You are the RUNWAY game voice. Follow CURRENT EVENT and call choose exactly once with an ALLOWED CHOICE.'
const SESSION_CAP_MS = 10 * 60 * 1000
const IDLE_NULL_CTX_MS = 10 * 60 * 1000
const ICE_GATHER_TIMEOUT_MS = 1000
const SPEAKING_SETTLE_MS = 1200

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
  let sessionUpdateBroken = false
  let unsubCtx: (() => void) | null = null
  let capTimer: ReturnType<typeof setTimeout> | null = null
  let nullCtxTimer: ReturnType<typeof setTimeout> | null = null
  let speakTimer: ReturnType<typeof setTimeout> | null = null
  let lastCtxId: string | null = null

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

  const pushContext = (ctx: VoiceContext) => {
    if (!started) return
    send({ type: 'session.instructions.append', delegation_id: null, content: ctx.contextText })
    if (sessionUpdateBroken) return
    send({
      type: 'session.update',
      session: {
        delegation: {
          type: 'responses',
          responses: {
            instructions: `${BASE}\n\n${ctx.contextText}`,
            tools: [CHOOSE_TOOL],
            tool_choice: 'required',
            parallel_tool_calls: false,
          },
        },
      },
    })
  }

  const onCtx = (ctx: VoiceContext | null) => {
    if (nullCtxTimer) { clearTimeout(nullCtxTimer); nullCtxTimer = null }
    if (!ctx) {
      nullCtxTimer = setTimeout(() => { if (active()) disconnect('no voice moment for 10 minutes') }, IDLE_NULL_CTX_MS)
      return
    }
    if (ctx.eventId !== lastCtxId) {
      lastCtxId = ctx.eventId
      set({ caption: '', heard: '' })
    }
    pushContext(ctx)
  }

  const markSpeaking = () => {
    if (!active()) return
    if (state.status !== 'speaking') set({ status: 'speaking' })
    if (speakTimer) clearTimeout(speakTimer)
    speakTimer = setTimeout(() => { if (state.status === 'speaking') set({ status: 'listening' }) }, SPEAKING_SETTLE_MS)
  }

  const handleToolCall = (item: { call_id?: string; arguments?: string }) => {
    let ok = false
    try {
      const args = JSON.parse(item.arguments ?? '{}') as { eventId?: string; choiceId?: string; constraint?: string }
      ok = dispatchVoiceChoice(String(args.eventId ?? ''), String(args.choiceId ?? ''), typeof args.constraint === 'string' ? args.constraint : undefined)
      if (!ok) console.warn('[voice] choose rejected', args)
    } catch (e) {
      console.warn('[voice] bad choose arguments', item.arguments, e)
    }
    set({ caption: '' })
    send({
      type: 'response.item.create',
      item: { type: 'function_call_output', call_id: item.call_id, output: ok ? 'ok' : 'rejected: illegal or stale choice' },
    })
    send({ type: 'response.create' })
  }

  const onMessage = (raw: string) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }
    const type = msg.type as string | undefined
    switch (type) {
      case 'session.started': {
        started = true
        set({ status: 'listening', reason: undefined })
        const ctx = getVoiceContext()
        if (ctx) { lastCtxId = ctx.eventId; pushContext(ctx) }
        return
      }
      case 'session.output_transcript.delta': {
        const delta = typeof msg.delta === 'string' ? msg.delta : ''
        set({ caption: (state.caption + delta).slice(-400) })
        markSpeaking()
        return
      }
      case 'session.input_transcript.delta': {
        const delta = typeof msg.delta === 'string' ? msg.delta : ''
        set({ heard: (state.heard + delta).slice(-200) })
        return
      }
      case 'response.event': {
        const ev = (msg.event ?? {}) as Record<string, unknown>
        if (ev.type === 'response.output_item.done') {
          const item = ev.item as { type?: string; name?: string; call_id?: string; arguments?: string } | undefined
          if (item?.type === 'function_call' && item.name === 'choose') handleToolCall(item)
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
        const text = JSON.stringify(err).toLowerCase()
        if (text.includes('model') && !sessionUpdateBroken) {
          sessionUpdateBroken = true
          console.warn('[voice] session.update rejected (model); relying on instructions.append only')
          return
        }
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
    try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* ignore */ }
    try { dc?.close() } catch { /* ignore */ }
    try { pc?.close() } catch { /* ignore */ }
    if (audioEl) {
      try { audioEl.pause(); audioEl.srcObject = null; audioEl.remove() } catch { /* ignore */ }
    }
    stream = null; dc = null; pc = null; audioEl = null
    started = false
    lastCtxId = null
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
  }
}
