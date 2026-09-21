import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'

register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    if (error && error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      return nextResolve(specifier + '.ts', context)
    }
    throw error
  }
}
`)}`, import.meta.url)

const { createLiveClient } = await import('./src/voice/liveClient.ts')
const { _setVoiceContext, _setVoiceDispatcher } = await import('./src/state/voiceBridge.ts')

const tick = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

class FakeTrack {
  enabled = true
  stopped = false
  stop() { this.stopped = true }
}

class FakeStream {
  constructor(track = new FakeTrack()) { this.track = track }
  getTracks() { return [this.track] }
  getAudioTracks() { return [this.track] }
}

class FakeDataChannel {
  readyState = 'open'
  sent = []
  onmessage = null
  onclose = null
  send(text) { this.sent.push(JSON.parse(text)) }
  close() { this.readyState = 'closed' }
  receive(message) { this.onmessage?.({ data: JSON.stringify(message) }) }
}

class FakePeerConnection {
  static all = []
  iceGatheringState = 'complete'
  connectionState = 'new'
  localDescription = null
  ontrack = null
  onconnectionstatechange = null
  dataChannel = new FakeDataChannel()
  constructor() { FakePeerConnection.all.push(this) }
  addTrack() {}
  createDataChannel() { return this.dataChannel }
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\nmock-offer' } }
  async setLocalDescription(offer) { this.localDescription = offer }
  async setRemoteDescription() {}
  addEventListener() {}
  removeEventListener() {}
  close() { this.connectionState = 'closed'; this.onconnectionstatechange?.() }
}

function installSilentBrowser(getUserMedia) {
  const audio = []
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { RTCPeerConnection: FakePeerConnection },
  })
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: FakePeerConnection,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: { appendChild() {} },
      createElement() {
        const element = {
          autoplay: false,
          muted: false,
          srcObject: null,
          style: {},
          setAttribute() {},
          play: async () => {},
          pause() {},
          remove() {},
        }
        audio.push(element)
        return element
      },
    },
  })
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      sdp: 'v=0\r\nmock-answer',
      runway: { responses: { model: 'router', instructions: 'base', tools: [] } },
    }),
  })
  return audio
}

async function connectStarted(client, channelIndex = -1) {
  await client.connect()
  const peer = FakePeerConnection.all.at(channelIndex)
  peer.dataChannel.receive({ type: 'session.started' })
  return peer
}

test('dedupes a pending microphone request and stops a stream resolved after cancellation', async () => {
  const pending = deferred()
  let calls = 0
  installSilentBrowser(() => { calls++; return pending.promise })
  const immediateClient = createLiveClient()
  const immediate = immediateClient.connect()
  immediateClient.disconnect()
  await immediate
  await tick()
  assert.equal(calls, 0)

  const client = createLiveClient()
  const first = client.connect()
  const duplicate = client.connect()
  assert.equal(first, duplicate)
  await tick()
  assert.equal(calls, 1)

  client.disconnect()
  const lateStream = new FakeStream()
  pending.resolve(lateStream)
  await first

  assert.equal(lateStream.track.stopped, true)
  assert.equal(client.getState().status, 'idle')
  assert.equal(FakePeerConnection.all.length, 0)
})

test('ignores stale callbacks after reconnect and applies mute to remote output and input', async () => {
  FakePeerConnection.all.length = 0
  const streams = [new FakeStream(), new FakeStream()]
  const audio = installSilentBrowser(async () => streams.shift())
  const client = createLiveClient()
  const first = await connectStarted(client)

  client.disconnect()
  const second = await connectStarted(client)
  first.dataChannel.receive({ type: 'session.started' })
  first.dataChannel.receive({ type: 'session.output_transcript.delta', delta: 'stale' })
  assert.equal(client.getState().caption, '')
  assert.equal(client.getState().status, 'listening')

  client.setMuted(true)
  assert.equal(audio.at(-1).muted, true)
  assert.equal(streams.length, 0)
  assert.equal(second.dataChannel.sent.at(-1).type, 'session.input_audio.mute')
  client.setMuted(false)
  assert.equal(audio.at(-1).muted, false)
  assert.equal(second.dataChannel.sent.at(-1).type, 'session.input_audio.unmute')
  client.disconnect()
})

test('respects mic hold at connect and session start, rejects held or muted tool calls, and permits processing hold', async () => {
  FakePeerConnection.all.length = 0
  const track = new FakeTrack()
  installSilentBrowser(async () => new FakeStream(track))
  let dispatches = 0
  _setVoiceContext({
    eventId: 'E01',
    contextText: 'CURRENT EVENT',
    allowedChoices: [{ id: 'focused', label: 'Focused' }],
  })
  _setVoiceDispatcher(() => { dispatches++; return true })
  const client = createLiveClient()

  client.setMicHold(true)
  const peer = await connectStarted(client)
  assert.equal(track.enabled, false)
  assert.ok(peer.dataChannel.sent.some((message) => message.type === 'session.input_audio.mute'))
  assert.ok(peer.dataChannel.sent.some((message) => message.session?.delegation?.responses?.tool_choice === 'auto'))

  peer.dataChannel.receive({ type: 'session.delegation.created', delegation_id: 'held' })
  client.setMicHold(false)
  const heldMessages = peer.dataChannel.sent.length
  peer.dataChannel.receive({
    type: 'response.event',
    delegation_id: 'held',
    event: { type: 'response.output_item.done', item: { type: 'function_call', name: 'choose', call_id: 'held-call', arguments: '{"eventId":"E01","choiceId":"focused"}' } },
  })
  assert.equal(dispatches, 0)
  assert.equal(peer.dataChannel.sent.length, heldMessages + 1)
  assert.match(peer.dataChannel.sent.findLast((message) => message.item?.call_id === 'held-call').item.output, /held/)

  peer.dataChannel.receive({ type: 'session.delegation.created', delegation_id: 'processing' })
  client.setMicHold(true)
  peer.dataChannel.receive({
    type: 'response.event',
    delegation_id: 'processing',
    event: { type: 'response.output_item.done', item: { type: 'function_call', name: 'choose', call_id: 'processing-call', arguments: '{"eventId":"E01","choiceId":"focused"}' } },
  })
  assert.equal(dispatches, 1)

  peer.dataChannel.receive({ type: 'session.delegation.created', delegation_id: 'muted' })
  client.setMuted(true)
  peer.dataChannel.receive({
    type: 'response.event',
    delegation_id: 'muted',
    event: { type: 'response.output_item.done', item: { type: 'function_call', name: 'choose', call_id: 'muted-call', arguments: '{"eventId":"E01","choiceId":"focused"}' } },
  })
  assert.equal(dispatches, 1)
  assert.match(peer.dataChannel.sent.findLast((message) => message.item?.call_id === 'muted-call').item.output, /muted/)
  client.disconnect()
  _setVoiceContext(null)
  _setVoiceDispatcher(() => false)
})

test('keeps input transcripts as captions only and cancels sayAsLive waiters on disconnect', async () => {
  FakePeerConnection.all.length = 0
  installSilentBrowser(async () => new FakeStream())
  let dispatches = 0
  _setVoiceContext({
    eventId: 'E02',
    contextText: 'CURRENT EVENT',
    allowedChoices: [{ id: 'focused', label: 'Focused' }],
  })
  _setVoiceDispatcher(() => { dispatches++; return true })
  const client = createLiveClient()
  const peer = await connectStarted(client)

  peer.dataChannel.receive({ type: 'session.input_transcript.delta', delta: 'focused' })
  await tick()
  assert.equal(client.getState().heard, 'focused')
  assert.equal(dispatches, 0)

  _setVoiceContext(null)
  assert.equal(peer.dataChannel.sent.at(-1).session.delegation.responses.tool_choice, 'none')

  const speaking = client.sayAsLive('A scripted line')
  client.setMuted(true)
  assert.equal(await speaking, false)
  assert.equal(await client.sayAsLive('Muted line'), false)
  client.disconnect()
  _setVoiceDispatcher(() => false)
})
