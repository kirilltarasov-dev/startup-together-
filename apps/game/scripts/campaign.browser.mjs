import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import { CAMPAIGN_EVENTS, campaignEventAt } from '../src/events/campaign.ts'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:5182'
const output = new URL('../node_modules/.cache/runway-campaign/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
const errors = []
let paidRequests = 0
page.on('pageerror', (error) => errors.push(error.message))
await page.setRequestInterception(true)
page.on('request', (request) => {
  if (/\/api\/(missions|voice)/.test(request.url())) {
    paidRequests++
    request.abort()
  } else request.continue()
})
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(text) && b.checkVisibility()), { timeout: 20000 }, label)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) {
      await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await button.click()
      return
    }
  }
  throw new Error(`Missing button ${label}`)
}
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('runway.campaign.v1')).state)
try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('NEW CAMPAIGN')
  for (let index = 0; index < CAMPAIGN_EVENTS.length; index++) {
    await page.waitForFunction((index) => {
      const s = JSON.parse(localStorage.getItem('runway.campaign.v1') ?? 'null')?.state
      return s?.eventIndex === index && s.screen === 'play'
    }, {}, index)
    const event = campaignEventAt(index, await state())
    const choice = event.id === 'E04' ? event.choices.find((c) => c.id === 'disable_feed') : event.choices[0]
    await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => (b.textContent.includes('SKIP') || b.textContent.includes(label)) && b.checkVisibility()), {}, choice.label)
    for (const button of await page.$$('button')) {
      if (await button.evaluate((element) => element.textContent.includes('SKIP') && element.checkVisibility())) { await button.click(); break }
    }
    await click(choice.label)
    await page.waitForFunction((id) => !!JSON.parse(localStorage.getItem('runway.campaign.v1')).state.resolved[id], {}, event.id)
    if (event.id === 'C1') {
      const before = await state()
      await click('SAVE & TITLE')
      await page.reload({ waitUntil: 'networkidle0' })
      await page.mouse.click(720, 450)
      await click('RESUME CAMPAIGN')
      const after = await state()
      assert.equal(after.cash, before.cash)
      assert.equal(after.eventIndex, before.eventIndex)
      assert.equal(after.resolved.C1, before.resolved.C1)
    }
    if (event.id === 'C20') {
      await new Promise((resolve) => setTimeout(resolve, 700))
      await page.screenshot({ path: `${output}founder-consequence.png` })
    }
    await click('CONTINUE')
    if (event.id === 'E02') await click('OF COURSE')
    else if (CAMPAIGN_EVENTS[index + 1]?.scene !== event.scene && index + 1 < CAMPAIGN_EVENTS.length) await click('WALK THERE')
    console.log(`Campaign ${index + 1}/${CAMPAIGN_EVENTS.length}: ${event.id} / ${choice.id}`)
  }
  await page.waitForFunction(() => document.body.innerText.includes('RUNWAY COMPLETE'))
  const final = await state()
  assert.equal(Object.keys(final.resolved).length, 35)
  assert.equal(final.missionOutcome, 'skipped')
  await new Promise((resolve) => setTimeout(resolve, 800))
  await page.screenshot({ path: `${output}ending.png` })
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((resolve) => setTimeout(resolve, 300))
  await page.screenshot({ path: `${output}ending-narrow.png` })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.setViewport({ width: 1440, height: 900 })
  await click('RESTART')
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForFunction(() => document.body.innerText.includes('What are we building?'))
  assert.equal(await page.$('[aria-label="Campaign progress"]'), null)
  assert.equal(paidRequests, 0)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ result: 'PASS', encounters: 35, saveResume: true, demoStillAvailable: true, paidRequests, errors, final: { cash: final.cash, health: final.health, trust: final.trust, debt: final.debt } }, null, 2))
} catch (error) {
  await page.screenshot({ path: `${output}failure.png` }).catch(() => {})
  console.log(JSON.stringify({ errors, paidRequests, state: await state().catch(() => null) }, null, 2))
  throw error
} finally {
  await browser.close()
}
