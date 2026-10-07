import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
page.on('pageerror', (error) => console.error('PAGEERROR', error.message))
page.on('console', (message) => { if (message.type() === 'error') console.error('CONSOLE', message.text()) })
await page.evaluateOnNewDocument(() => {
  window.__runwaySpeech = []
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
      window.__runwaySpeech.push({ text: utterance.text, visible: document.body.innerText.includes(utterance.text), at: performance.now() })
      setTimeout(() => utterance.onend?.(), 20)
    },
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  } })
})
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(text) && button.checkVisibility()), { timeout: 20000 }, label)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) { await button.click(); return }
  }
}
try {
  await page.setViewport({ width: 1440, height: 900 })
  const base = (process.env.TEST_URL ?? 'http://127.0.0.1:5191').replace(/\/$/, '')
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await new Promise((resolve) => setTimeout(resolve, 300))
  await click('START RUNWAY')
  await page.waitForSelector('[data-world="third-person"]', { timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 1600))
  assert.equal(await page.evaluate(() => window.__runwaySpeech.length), 0, 'hidden story must never speak')
  assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Story interaction"]')), null, 'hidden story is not mounted')
  await click('TALK TO FOUNDERS')
  await page.waitForFunction(() => window.__runwaySpeech.length >= 3, { timeout: 15000 })
  await click('Founders only')
  await page.waitForFunction(() => document.body.innerText.includes('Decision applied: Founders only'), { timeout: 10000 })
  await page.waitForFunction(() => window.__runwaySpeech.length >= 4, { timeout: 10000 })
  const speech = await page.evaluate(() => window.__runwaySpeech)
  assert.deepEqual(speech.map((entry) => entry.visible), [true, true, true, true])
  assert.match(speech[0].text, /social network for founders/)
  assert.match(speech[3].text, /Small market/)
  console.log('VOICE_VISIBLE_ORDER_PASS', JSON.stringify(speech, null, 2))
} finally {
  await browser.close()
}
