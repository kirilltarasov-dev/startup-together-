import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (req) => { if (/\/api\/(voice|missions)/.test(req.url())) errors.push(`Unexpected paid API request: ${req.url()}`) })
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(text) && button.checkVisibility()), { timeout: 20000 }, label)
  for (const button of await page.$$('button')) if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) { await button.click(); return }
}
try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5191', { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForSelector('[data-story-open="false"]', { timeout: 30000 })
  await click('TALK TO FOUNDERS')
  await click('SKIP')
  const accepted = await page.evaluate(async () => (await import('/src/state/voiceBridge.ts')).dispatchVoiceChoice('E01', 'focused'))
  assert.equal(accepted, true)
  await page.waitForFunction(() => document.body.innerText.includes('Decision applied: Founders only'))
  const state = await page.evaluate(async () => {
    const game = (await import('/src/state/gameStore.ts')).useGame.getState()
    return { health: game.health, morale: game.morale, resolved: game.resolved.E01 }
  })
  assert.deepEqual(state, { health: 60, morale: 75, resolved: 'focused' })
  const repeat = await page.evaluate(async () => (await import('/src/state/voiceBridge.ts')).dispatchVoiceChoice('E01', 'focused'))
  assert.equal(repeat, false)
  assert.deepEqual(errors, [])
  console.log('VOICE_ACTION_APPLIED', JSON.stringify({ accepted, repeat, visible: true, state }))
} finally { await browser.close() }
