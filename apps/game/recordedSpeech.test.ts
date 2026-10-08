import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cancelRecordings, playRecording } from './src/voice/recordedSpeech.ts'
import { ttsCancel, ttsSetMuted } from './src/voice/tts.ts'

test('recorded narration finishes, cancels on mute/Continue, and reports missing assets without hanging', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Audio')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const made: FakeAudio[] = []
  class FakeAudio {
    onended: (() => void) | null = null
    onerror: (() => void) | null = null
    onplaying: (() => void) | null = null
    paused = false
    src = ''
    constructor(src: string) { this.src = src; made.push(this) }
    play() { return Promise.resolve() }
    pause() { this.paused = true }
    removeAttribute() { this.src = '' }
    load() {}
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  const clip = { who: 'sergio', text: 'Then we ship your laptop.', voice: 'es-CO-GonzaloNeural', path: '/assets/voices/sergio-abc.wav' }
  try {
    const ended = playRecording(clip)
    made.at(-1)!.onplaying!()
    made.at(-1)!.onended!()
    assert.equal(await ended, 'finished')
    for (const stop of [ttsCancel, () => ttsSetMuted(true)]) {
      const cancelled = playRecording(clip)
      stop()
      assert.equal(await cancelled, 'cancelled')
      assert.equal(made.at(-1)!.paused, true)
      assert.equal(made.at(-1)!.src, '')
      ttsSetMuted(false)
    }
    const failed = playRecording(clip)
    made.at(-1)!.onerror!()
    assert.equal(await failed, 'unavailable')
    const partial = playRecording(clip)
    made.at(-1)!.onplaying!()
    made.at(-1)!.onerror!()
    assert.equal(await partial, 'finished', 'do not replay a half-heard line in another voice')
    FakeAudio.prototype.play = () => Promise.reject(new Error('Autoplay denied'))
    assert.equal(await playRecording(clip), 'unavailable')
    assert.equal(await playRecording({ ...clip, path: 'https://example.com/other.wav' }), 'unavailable')
  } finally {
    cancelRecordings()
    ttsSetMuted(false)
    if (descriptor) Object.defineProperty(globalThis, 'Audio', descriptor)
    else Reflect.deleteProperty(globalThis, 'Audio')
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
