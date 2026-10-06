import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initTts, speakLine, ttsCancel, ttsSetMuted, ttsVoiceReport } from './src/voice/tts.ts'
import { handleHeard, initCommandEar, isCommandEarActive } from './src/voice/commandEar.ts'

test('voice preferences, quality exclusions and cancellation use silent mocks', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance')
  const voice = (name: string, lang: string) => ({ name, lang, localService: true })
  let voices = [
    voice('Yuri Enhanced', 'ru-RU'), voice('Carlos Natural', 'es-CO'),
    voice('Rishi Enhanced', 'en-IN'), voice('Daniel Enhanced', 'en-GB'),
  ]
  let changed = () => {}
  const spoken: { voice?: { name: string }; pitch?: number; onend?: (() => void) | null }[] = []
  class Utterance {
    text: string
    constructor(text: string) { this.text = text }
  }
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: (_type: string, cb: () => void) => { changed = cb },
      removeEventListener: () => {},
      speak: (u: (typeof spoken)[number]) => { spoken.push(u) },
      cancel: () => {}, // Deliberately no browser completion callback.
    },
  } })
  const cleanup = initTts()
  try {
    let report = ttsVoiceReport()
    assert.match(report.kirill, /Yuri Enhanced.*primary ru-RU/)
    assert.match(report.sergio, /Carlos Natural.*primary es-CO/)
    assert.match(report.sadman, /Rishi Enhanced.*primary en-IN/)
    const first = speakLine('kirill', 'Hello')
    assert.equal(spoken[0].pitch, 1)
    ttsCancel()
    await first
    const second = speakLine('sergio', 'Hello')
    ttsSetMuted(true)
    await second
    await speakLine('sadman', 'Muted')
    assert.equal(spoken.length, 2)
    ttsSetMuted(false)

    voices = [voice('Daniel Compact', 'en-GB'), voice('Google US English', 'en-US')]
    changed()
    report = ttsVoiceReport()
    for (const selected of Object.values(report)) {
      assert.doesNotMatch(selected, /Compact/)
      assert.match(selected, /requested accent unavailable/)
    }
    voices = [voice('Daniel Compact', 'en-GB'), voice('Zarvox', 'en-US')]
    changed()
    await speakLine('kirill', 'No acceptable voice')
    assert.equal(spoken.length, 2)
    assert.match(ttsVoiceReport().kirill, /no acceptable voice/)

    voices = []
    changed()
    await speakLine('sergio', 'Voices loading')
    voices = [voice('Carlos Natural', 'es-CO')]
    assert.match(ttsVoiceReport().sergio, /Carlos Natural/)
    initCommandEar()()
    handleHeard('send Devin')
    assert.equal(isCommandEarActive(), false)
  } finally {
    cleanup()
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (originalUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', originalUtterance)
    else Reflect.deleteProperty(globalThis, 'SpeechSynthesisUtterance')
  }
})
