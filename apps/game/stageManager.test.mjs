import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'

test('scripted voice identity, reset and held-floor cancellation', async () => {
  let receive
  let finish
  let held = false
  let liveSpeaking = false
  const spoken = []
  const client = {
    setMicHold: (value) => { held = value },
    isChooseInFlight: () => false,
    isLiveSpeaking: () => liveSpeaking,
    noteScene: () => {},
    sayAsLive: () => { throw new Error('Scripted voices must not switch to Live') },
  }
  globalThis.__stageTest = {
    subscribeSpeak: (cb) => { receive = cb; return () => { receive = null } },
    getLiveClient: () => client,
    speakLine: (who, text) => {
      assert.equal(held, true)
      spoken.push({ who, text })
      return new Promise((resolve) => { finish = resolve })
    },
    ttsCancel: () => { finish?.() },
    ttsReset: () => { finish?.() },
    ttsIsMuted: () => false,
  }
  const source = stripTypeScriptTypes(await readFile(new URL('./src/voice/stageManager.ts', import.meta.url), 'utf8'))
    .replace(/^import .* from .*\n/gm, '')
  const module = await import(`data:text/javascript;base64,${Buffer.from(
    'const {subscribeSpeak,getLiveClient,speakLine,ttsCancel,ttsReset,ttsIsMuted}=globalThis.__stageTest;\n' + source,
  ).toString('base64')}`)
  const cleanup = module.stageInit()
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const send = (tag, lines) => receive({ tag, lines, text: '' })
  try {
    send('E01:dialogue', [{ who: 'sergio', text: 'First' }, { who: 'kirill', text: 'Old queue' }])
    await delay(10)
    assert.deepEqual(spoken, [{ who: 'sergio', text: 'First' }])
    module.stageReset()
    send('E02:dialogue', [{ who: 'sadman', text: 'New scene' }])
    await delay(300)
    assert.deepEqual(spoken.map((line) => line.text), ['First', 'New scene'])
    module.stageCut()
    await delay(300)
    assert.equal(module.getFloor(), 'listening')
    liveSpeaking = true
    send('E03:dialogue', [{ who: 'investor', text: 'Canceled while waiting' }])
    await delay(10)
    module.stageReset()
    liveSpeaking = false
    await delay(150)
    assert.equal(spoken.length, 2)
    liveSpeaking = true
    send('E04:dialogue', [{ who: 'kirill', text: 'Cut while waiting' }])
    await delay(10)
    assert.equal(module.stageCut(), true)
    liveSpeaking = false
    await delay(150)
    assert.equal(spoken.length, 2)
  } finally {
    cleanup()
    await delay(300)
    delete globalThis.__stageTest
  }
})
