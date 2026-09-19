import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const output = new URL('../node_modules/.cache/runway-third-person/', import.meta.url).pathname
const locomotionOutput = new URL('../node_modules/.cache/runway-locomotion/', import.meta.url).pathname
await mkdir(output, { recursive: true })
await mkdir(locomotionOutput, { recursive: true })
const BROWSERS = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser']
const executablePath = process.env.BROWSER_PATH ?? BROWSERS.find((path) => existsSync(path)) ?? BROWSERS[0]
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(text) && b.checkVisibility()), { timeout: 20000 }, label)
  for (const b of await page.$$('button')) if (await b.evaluate((el, text) => el.textContent.includes(text) && el.checkVisibility(), label)) { await b.evaluate((el) => el.scrollIntoView({ block: 'center' })); await b.click(); return }
}
/**
 * Locomotion route (feat/polish-locomotion): the character walks into the glass-wall corner (camera obstruction),
 * comes back, walks 2 s, runs 2 s, jumps once. Evidence comes from the canvas dataset written by
 * CharacterController/CharacterAnimator: anim, grounded, position, camDist, facing, toeY.
 */
async function locomotionRoute() {
  const dataset = () => page.$eval('canvas', (c) => ({ ...c.dataset }))
  const samples = []
  const sample = async () => { try { samples.push({ t: performance.now(), ...(await dataset()) }) } catch { /* canvas re-mount */ } }
  const sampler = setInterval(sample, 40)
  // Screenshots stall the render loop and can blur the window (which clears held keys), so re-assert held keys after each one.
  const shot = async (name, held = []) => { await page.screenshot({ path: locomotionOutput + name + '.png' }); for (const key of held) await page.keyboard.down(key) }
  await click('RESET POSITION')
  await wait(1200)
  const spawn = await dataset()
  const spawnY = Number(spawn.position.split(',')[1])
  await shot('idle')
  assert.equal(spawn.anim, 'idle')
  assert.equal(spawn.grounded, 'true')
  assert.equal(spawn.usingWalkAsRunFallback, 'true', 'no authored run clip: the walk-as-run fallback must be flagged')
  assert.ok(Math.abs(Number(spawn.toeY) - 0.035) < 0.02, `soles on the floor at idle (toe joint y=${spawn.toeY})`)
  // 1. glass-wall corner: camera-controls obstruction would pull the camera into the torso without the clamp
  await page.keyboard.down('a'); await wait(1400)
  const corner = await dataset()
  await shot('corner-camera-obstructed', ['a'])
  await page.keyboard.up('a'); await page.keyboard.down('d'); await wait(1500); await page.keyboard.up('d')
  await wait(300)
  // 2. walk 2 s (S = toward the camera, out through the doorway)
  await page.keyboard.down('s'); await wait(1200)
  const walking = await dataset()
  await shot('walk', ['s'])
  await wait(800)
  // 3. run 2 s (hold Shift)
  await page.keyboard.down('Shift'); await wait(1200)
  const running = await dataset()
  await shot('run', ['s', 'Shift'])
  await wait(800)
  await page.keyboard.up('Shift'); await page.keyboard.up('s'); await wait(600)
  const stopped = await dataset()
  // 4. jump once
  await page.keyboard.down(' '); await wait(100); await page.keyboard.up(' ')
  await wait(380)
  const airborne = await dataset()
  await shot('airborne')
  await wait(420)
  await shot('landing')
  await wait(1200)
  clearInterval(sampler)
  await sample()
  const landed = await dataset()
  const groundedSeries = samples.map((s) => s.grounded)
  const flips = groundedSeries.filter((value, index) => index > 0 && value !== groundedSeries[index - 1])
  const animSeries = samples.map((s) => s.anim).filter((value, index, all) => index === 0 || value !== all[index - 1])
  const inOrder = (sequence, expected) => { let cursor = 0; for (const item of sequence) if (item === expected[cursor]) cursor++; return cursor === expected.length }
  const camDistances = samples.map((s) => Number(s.camDist)).filter((value) => Number.isFinite(value) && value > 0)
  const facing = samples.map((s) => Number(s.facing)).filter((value) => Number.isFinite(value))
  const summary = { spawnY, corner: { position: corner.position, camDist: corner.camDist, camPolar: corner.camPolar }, walking: { anim: walking.anim, facing: walking.facing, position: walking.position }, running: { anim: running.anim, facing: running.facing, position: running.position }, stopped: { anim: stopped.anim, camPolar: stopped.camPolar }, airborne: { anim: airborne.anim, grounded: airborne.grounded, position: airborne.position }, landed: { anim: landed.anim, position: landed.position, camPolar: landed.camPolar, takeoffs: landed.takeoffs, landings: landed.landings }, flips, animSeries, minCamDist: Math.min(...camDistances), forwardFacingShare: facing.filter((value) => value > 0.9).length / facing.length, maxY: Math.max(...samples.map((s) => Number(s.position.split(',')[1]))) }
  console.log('LOCOMOTION', JSON.stringify(summary))
  assert.deepEqual(flips, ['false', 'true'], 'grounded flips false then true exactly once (one takeoff, one landing)')
  assert.equal(landed.takeoffs, '1', 'the animator saw exactly one takeoff edge')
  assert.equal(landed.landings, '1', 'the animator saw exactly one landing edge (one-shot land)')
  // the 220 ms land window can fall between 40 ms samples after the landing screenshot stall, hence the counter above
  assert.ok(inOrder(animSeries, ['walk', 'run', 'airborne', 'land']) || inOrder(animSeries, ['walk', 'run', 'airborne', 'idle']), `anim goes walk -> run -> airborne -> land/idle in order: ${animSeries.join(' > ')}`)
  assert.ok(['land', 'idle'].includes(landed.anim), 'settled after landing')
  assert.ok(Math.min(...camDistances) >= 1.1, `camera never closer than 1.1 m to the follow target (min ${Math.min(...camDistances)})`)
  assert.ok(Number(corner.camDist) < 3, 'the corner actually obstructed the camera (clamp path exercised)')
  assert.ok(Math.abs(Number(landed.position.split(',')[1]) - spawnY) < 0.05, `y after landing within 0.05 of spawn (${landed.position} vs ${spawnY})`)
  // steady-state facing (turn-arounds legitimately pass through negative values while the body rotates)
  assert.ok(Number(walking.facing) > 0.9 && Number(running.facing) > 0.9, `model faces its travel direction (walk ${walking.facing}, run ${running.facing})`)
  assert.ok(facing.filter((value) => value > 0.9).length > facing.length * 0.7, 'facing is forward for most of the route')
  assert.equal(walking.anim, 'walk')
  assert.equal(running.anim, 'run')
  assert.equal(airborne.grounded, 'false')
  assert.ok(['jump_takeoff', 'airborne'].includes(airborne.anim), 'never idle in the air')
  assert.ok(Number(landed.camPolar) > Number(corner.camPolar) + 0.3, `camera eased back down after the obstruction (${corner.camPolar} -> ${landed.camPolar})`)
}

try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5185', { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await wait(1500)
  await page.screenshot({ path: output + 'branding.png' })
  await click('START RUNWAY')
  await page.waitForSelector('canvas[data-character="sergio"]', { timeout: 30000 })
  await wait(1700)
  await page.screenshot({ path: output + 'spawn.png' })
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 900 })
    await click('FIRST-PERSON VIEW')
    await page.waitForSelector('[data-world="first-person"] canvas')
    await page.waitForNetworkIdle({ idleTime: 500 })
    await wait(1000)
    assert.equal(new URL(page.url()).searchParams.get('world'), 'first-person')
    await click('DRAG-TO-LOOK MODE')
    await page.waitForSelector('[data-exploring="true"]')
    await wait(500)
    const firstBefore = await page.$eval('canvas', (c) => c.dataset.position)
    await page.keyboard.down('w')
    await wait(500)
    await page.keyboard.up('w')
    const firstAfter = await page.$eval('canvas', (c) => c.dataset.position)
    assert.notEqual(firstBefore, firstAfter, 'First-person input moves the player')
    await page.screenshot({ path: output + `first-person-${width}.png` })
    await click('THIRD-PERSON VIEW')
    await page.waitForSelector('canvas[data-character="sergio"]', { timeout: 30000 })
    assert.equal(new URL(page.url()).searchParams.get('world'), 'third-person')
    await wait(500)
    await page.screenshot({ path: output + `third-person-${width}.png` })
  }
  await page.setViewport({ width: 1440, height: 900 })
  const before = await page.$eval('canvas', (c) => c.dataset.position)
  await page.keyboard.down('s')
  await wait(1000)
  await page.keyboard.up('s')
  await wait(400)
  const after = await page.$eval('canvas', (c) => c.dataset.position)
  console.log('POSITION', { before, after })
  assert.notEqual(before, after, 'Input moves the physical player')
  await page.screenshot({ path: output + 'walking.png' })
  if (!process.env.SKIP_LOCOMOTION) await locomotionRoute()
  await click('TALK TO FOUNDERS')
  await click('Founders only')
  await click('CONTINUE')
  await click('Test the launch')
  await click('CONTINUE')
  await click('OF COURSE')
  await click('TALK TO FOUNDERS')
  await click('Save every forint')
  await click('CONTINUE')
  await click('Disable the feed')
  await click('CONTINUE')
  await click('WALK THERE')
  await click('TALK TO FOUNDERS')
  await click('Take the bridge')
  await click('CONTINUE')
  await wait(600)
  await page.screenshot({ path: output + 'ending.png' })
  assert.ok((await page.evaluate(() => document.body.innerText)).includes('RUNWAY COMPLETE'))
  assert.deepEqual(errors, [])
  console.log('THIRD_PERSON_PASS', JSON.stringify({ before, after, errors, output, locomotionOutput }))
} catch (error) {
  await page.screenshot({ path: output + 'failure.png' }).catch(() => {})
  console.log('BROWSER_ERRORS', errors)
  console.log('PAGE_TEXT', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600)).catch(() => 'n/a'))
  throw error
} finally { await browser.close() }
