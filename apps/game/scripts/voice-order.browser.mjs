import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const { clips } = JSON.parse(await readFile(new URL('../.devin/scripted-voices/manifest.json', import.meta.url), 'utf8'))
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
const voiceRequests = []
page.on('request', (request) => { if (request.url().includes('/api/voice/')) voiceRequests.push(request.url()) })
page.on('pageerror', (error) => console.error('PAGEERROR', error.message))
page.on('console', (message) => { if (message.type() === 'error') console.error('CONSOLE', message.text()) })
await page.evaluateOnNewDocument((recordings) => {
  window.__runwaySpeech = []
  const NativeAudio = window.Audio
  window.Audio = class extends NativeAudio {
    constructor(src) {
      super(src)
      const clip = recordings.find(entry => entry.path === src)
      if (clip) this.addEventListener('playing', () => {
        window.__runwaySpeech.push({ text: clip.text, voice: clip.who, lang: clip.voice.slice(0, 5), recording: clip.voice, visible: document.body.innerText.includes(clip.text), at: performance.now() })
      }, { once: true })
    }
  }
  class MockUtterance {
    constructor(text) { this.text = text; this.onend = null; this.onerror = null }
  }
  const voices = [
    { name: 'Natural Sergio', lang: 'es-CO', localService: true, default: false, voiceURI: 'sergio' },
    { name: 'Natural Kirill', lang: 'ru-RU', localService: true, default: false, voiceURI: 'kirill' },
    { name: 'Natural Sadman', lang: 'en-IN', localService: true, default: false, voiceURI: 'sadman' },
    { name: 'Natural Investor', lang: 'en-GB', localService: true, default: true, voiceURI: 'investor' },
  ]
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    onvoiceschanged: null,
    getVoices: () => voices,
    speak: (utterance) => {
      window.__runwaySpeech.push({ text: utterance.text, voice: utterance.voice?.voiceURI, lang: utterance.lang, visible: document.body.innerText.includes(utterance.text), at: performance.now() })
      setTimeout(() => utterance.onend?.(), 20)
    },
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  } })
}, clips)
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(text) && button.checkVisibility()), { timeout: 20000 }, label)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) { await button.click(); return }
  }
}
try {
  const width = Number(process.env.TEST_WIDTH ?? 1440)
  const height = width < 500 ? 844 : 900
  await page.setViewport({ width, height })
  const base = (process.env.TEST_URL ?? 'http://127.0.0.1:5191').replace(/\/$/, '')
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.mouse.click(width / 2, height / 2)
  await new Promise((resolve) => setTimeout(resolve, 300))
  await click('START RUNWAY')
  if (['first-person', 'legacy'].includes(new URL(base).searchParams.get('world'))) {
    await page.waitForSelector('[data-world="first-person"]', { timeout: 30000 })
  } else {
    await page.waitForSelector('[data-world="third-person"]', { timeout: 30000 })
    await new Promise((resolve) => setTimeout(resolve, 1600))
    assert.equal(await page.evaluate(() => window.__runwaySpeech.length), 0, 'hidden story must never speak')
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Story interaction"]')), null, 'hidden story is not mounted')
    await click('TALK TO FOUNDERS')
  }
  await page.waitForFunction(() => window.__runwaySpeech.length >= 3, { timeout: 15000 })
  await click('Founders only')
  await page.waitForFunction(() => document.body.innerText.includes('Decision applied: Founders only'), { timeout: 10000 })
  await page.waitForFunction(() => window.__runwaySpeech.length >= 4, { timeout: 10000 })
  const speech = await page.evaluate(() => window.__runwaySpeech)
  assert.deepEqual(speech.map((entry) => entry.visible), [true, true, true, true])
  assert.deepEqual(speech.slice(0, 3).map((entry) => entry.voice), ['sergio', 'kirill', 'sadman'])
  assert.deepEqual(speech.slice(0, 3).map((entry) => entry.lang), ['es-CO', 'ru-RU', 'en-IN'])
  assert.equal(speech[0].recording, 'es-CO-GonzaloNeural', 'actual WAV playback, not browser fallback')
  assert.equal(speech[1].recording, 'ru-RU-DmitryNeural', 'actual WAV playback, not browser fallback')
  assert.equal(speech[0].text, 'A social network for founders. Every post is a launch. We announce it tonight.')
  assert.equal(speech[1].text, 'We have not written a single line.')
  assert.deepEqual(voiceRequests, [], 'scripted narration must not call the removed cloud TTS endpoint')
  assert.match(speech[0].text, /social network for founders/)
  assert.match(speech[3].text, /Small market/)
  await page.screenshot({ path: new URL(`../node_modules/.cache/voice-recovery-${width}.png`, import.meta.url).pathname })
  await click('CONTINUE')
  await page.waitForFunction(() => window.__runwaySpeech.some((entry) => entry.text.includes('I already tweeted the launch.')), { timeout: 15000 })
  const afterTransition = await page.evaluate(() => window.__runwaySpeech)
  assert.equal(afterTransition.at(-1).visible, true)
  assert.equal(afterTransition.filter((entry) => entry.text === speech[3].text).length, 1)
  console.log('VOICE_VISIBLE_ORDER_PASS', JSON.stringify(afterTransition, null, 2))
} finally {
  await browser.close()
}
