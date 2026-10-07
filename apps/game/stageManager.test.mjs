import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'

test('scripted voice identity, reset and held-floor cancellation', async () => {
  let receive
  let finish
  let held = false
  let liveSpeaking = false
  let replyHeld = false
  const spoken = []
  const client = {
    setMicHold: (value) => { held = value },
    isChooseInFlight: () => false,
    isLiveSpeaking: () => liveSpeaking,
    noteScene: () => {},
    sayAsLive: () => { throw new Error('Scripted voices must not switch to Live') },
    setConversationVisible: () => {},
    setReplyHold: (value) => { replyHeld = value },
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
    module.setStoryVisible(false)
    send('hidden:dialogue', [{ who: 'sergio', text: 'Not visible' }])
    await delay(450)
    assert.equal(spoken.length, 0)
    assert.equal(held, true)
    module.setStoryVisible(true)
    send('E01:dialogue', [{ who: 'sergio', text: 'First' }, { who: 'kirill', text: 'Old queue' }])
    assert.equal(held, true, 'mic closes immediately when dialogue is queued')
    assert.equal(replyHeld, true, 'old live reply is silenced during dialogue')
    await delay(100)
    assert.deepEqual(spoken, [], 'text gets a visual lead before audio starts')
    assert.equal(held, true, 'mic stays closed during visual lead')
    await delay(350)
    assert.deepEqual(spoken, [{ who: 'sergio', text: 'First' }])
    finish()
    await delay(300)
    assert.equal(held, true, 'mic stays closed in the gap between queued lines')
    module.stageReset()
    send('E02:dialogue', [{ who: 'sadman', text: 'New scene' }])
    await delay(1050)
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
    module.stageReset()
    send('E01:visible:0-1', [{ who: 'sergio', text: 'Old founder' }])
    await delay(450)
    send('E01:visible:1-2', [{ who: 'kirill', text: 'Old queue' }])
    send('E01:reaction:focused', [{ who: 'sergio', text: 'Decision reaction' }])
    await delay(850)
    assert.equal(spoken.at(-1)?.text, 'Decision reaction')
    assert.equal(spoken.some((line) => line.text === 'Old queue'), false)
    send('E02:visible:0-1', [{ who: 'sadman', text: 'New founder' }])
    await delay(850)
    assert.equal(spoken.at(-1)?.text, 'New founder')
  } finally {
    cleanup()
    await delay(300)
    delete globalThis.__stageTest
  }
})
