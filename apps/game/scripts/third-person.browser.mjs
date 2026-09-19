import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const output = new URL('../node_modules/.cache/runway-third-person/', import.meta.url).pathname
const locomotionOutput = new URL('../node_modules/.cache/runway-locomotion/', import.meta.url).pathname
const cameraOutput = new URL('../node_modules/.cache/runway-polish2-camera/', import.meta.url).pathname
await mkdir(output, { recursive: true })
await mkdir(locomotionOutput, { recursive: true })
await mkdir(cameraOutput, { recursive: true })
const BROWSERS = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser']
const executablePath = process.env.BROWSER_PATH ?? BROWSERS.find((path) => existsSync(path)) ?? BROWSERS[0]
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
// Diagnostic trail (printed on failure): every pointerdown/click target, whether it was still attached, and which
// mounted world it belonged to (worlds are numbered as they appear), plus story-panel toggles.
await page.evaluateOnNewDocument(() => {
  const ids = new WeakMap(); let nextId = 0
  const worldId = (node) => { const world = node?.closest?.('[data-world]'); if (!world) return null; if (!ids.has(world)) ids.set(world, ++nextId); return ids.get(world) }
  window.__trail = []
  for (const type of ['pointerdown', 'click']) document.addEventListener(type, (event) => window.__trail.push(`${(performance.now() / 1000).toFixed(2)} ${type} <${event.target.tagName?.toLowerCase()}> "${(event.target.textContent ?? '').trim().slice(0, 32)}" world#${worldId(event.target)} attached=${event.target.isConnected}`), true)
  new MutationObserver((records) => { for (const record of records) if (record.attributeName === 'data-story-open') window.__trail.push(`${(performance.now() / 1000).toFixed(2)} story-open=${record.target.getAttribute('data-story-open')} world#${worldId(record.target)}`) }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-story-open'] })
})
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/**
 * Page-side: the button containing `text` that is really clickable, once it has been so for 120 ms.
 * `App.tsx` swaps screens through `AnimatePresence mode="wait"` with a 0.4 s opacity fade, and the *exiting* screen
 * keeps re-rendering with the new store state: after OF COURSE the dying Result screen briefly grows its own
 * TALK TO FOUNDERS header (ImmersiveWorld `forced` flips once `screen` is 'play'). Clicking that ghost toggled a
 * story panel that was unmounted a few hundred ms later, so "Save every forint" never appeared (Chrome timing; Brave
 * happened to click after the fade). A button qualifies when it is visible, has a box, every ancestor is fully
 * opaque (no fade in or out in flight) and it is the topmost element at its centre (no overlay). It must stay the
 * same qualifying element for 120 ms, which an exiting screen cannot (its opacity drops within a frame or two).
 */
const settledButton = (text) => {
  const find = () => {
    for (const button of document.querySelectorAll('button')) {
      if (!button.textContent.includes(text) || button.disabled || !button.checkVisibility()) continue
      const rect = button.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      let opaque = true
      for (let node = button; node && node !== document.body; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 0.999) { opaque = false; break }
      if (!opaque) continue
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)), Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2)))
      if (top && button.contains(top)) return button
    }
    return null
  }
  const button = find()
  const settle = (window.__settle ??= { candidate: null, since: 0 })
  if (button !== settle.candidate) { settle.candidate = button; settle.since = performance.now() }
  if (!button || performance.now() - settle.since < 120) return null
  settle.candidate = null
  return button
}
async function click(label) {
  const handle = await page.waitForFunction(settledButton, { timeout: 20000, polling: 40 }, label)
  const element = handle.asElement()
  assert.ok(element, `clickable button "${label}"`)
  await element.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await element.click()
  await handle.dispose()
}
/** Header toggle: click TALK TO FOUNDERS and verify the story panel really opened (retries once, loudly). */
async function openStory() {
  for (let attempt = 1; ; attempt++) {
    await click('TALK TO FOUNDERS')
    try { await page.waitForSelector('[data-world="third-person"][data-story-open="true"]', { timeout: 4000 }); return } catch (error) {
      console.log(`STORY_TOGGLE_MISSED attempt ${attempt}`, await page.evaluate(() => window.__trail.slice(-8).join(' | ')))
      if (attempt >= 2) throw error
    }
  }
}
/**
 * Locomotion route (feat/polish-locomotion, camera swing-around from feat/polish2-camera): the character walks along
 * the glass wall into camera obstruction (the camera must swing around the side instead of rising top-down), RESET
 * POSITION restores spawn + default view, then walks 2 s, runs 2 s, jumps once. Evidence comes from the canvas
 * dataset written by CharacterController/CharacterAnimator: anim, grounded, position, camDist, camPolar, camAzimuth,
 * camSwing, facing, toeY.
 */
async function locomotionRoute() {
  const dataset = () => page.$eval('canvas', (c) => ({ ...c.dataset }))
  const samples = []
  const sample = async () => { try { samples.push({ t: performance.now(), ...(await dataset()) }) } catch { /* canvas re-mount */ } }
  const sampler = setInterval(sample, 40)
  // Screenshots stall the render loop for an unpredictable time (seconds under SwiftShader) while the page keeps
  // simulating in real time, and they can blur the window (which clears held keys). Release the held keys for the
  // capture so the stall does not turn into travel (the courtyard fence is only 12.5 m out), then re-assert them.
  const shot = async (name, held = []) => { for (const key of held) await page.keyboard.up(key); await page.screenshot({ path: locomotionOutput + name + '.png' }); for (const key of held) await page.keyboard.down(key) }
  await click('RESET POSITION')
  await wait(1200)
  const spawn = await dataset()
  const spawnY = Number(spawn.position.split(',')[1])
  await shot('idle')
  assert.equal(spawn.anim, 'idle')
  assert.equal(spawn.grounded, 'true')
  assert.equal(spawn.usingWalkAsRunFallback, 'true', 'no authored run clip: the walk-as-run fallback must be flagged')
  assert.ok(Math.abs(Number(spawn.toeY) - 0.035) < 0.02, `soles on the floor at idle (toe joint y=${spawn.toeY})`)
  // 1. glass wall: once the character passes the doorway edge the default view (camera outside the glass) is obstructed;
  //    camera-controls would pull the camera into the torso without the clamp, Phase 1 then rose to a top-down view.
  //    Now the post-step swings the azimuth around to a side view along the glass while the polar angle holds.
  const cornerStart = performance.now()
  await page.keyboard.down('a'); await wait(1400)
  const corner = await dataset()
  await shot('corner-camera-obstructed', ['a'])
  await wait(1600)
  const cornerAfter = await dataset()
  await page.keyboard.up('a')
  const cornerEnd = performance.now()
  await page.screenshot({ path: cameraOutput + 'corner-after.png' })
  await wait(300)
  // RESET POSITION restores spawn and the default follow view (the swing never undoes itself: no ping-pong)
  await click('RESET POSITION')
  await wait(900)
  const afterReset = await dataset()
  // 2. walk ~1.6 s (S = toward the camera, out through the doorway)
  await page.keyboard.down('s'); await wait(1200)
  const walking = await dataset()
  await shot('walk', ['s'])
  await wait(400)
  // 3. run ~1.6 s (hold Shift). The courtyard fence is 12.5 m out: samples are taken early enough that a physics
  //    catch-up burst after a screenshot stall cannot have parked the character against the fence (idle) first.
  await page.keyboard.down('Shift'); await wait(1000)
  const running = await dataset()
  await shot('run', ['s', 'Shift'])
  await wait(600)
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
  const cornerSamples = samples.filter((s) => s.t >= cornerStart && s.t <= cornerEnd && Number(s.camDist) > 0)
  const cornerSeries = { camDist: cornerSamples.map((s) => Number(s.camDist)), camPolar: cornerSamples.map((s) => Number(s.camPolar)), camAzimuth: cornerSamples.map((s) => Number(s.camAzimuth)), swingFrames: cornerSamples.filter((s) => s.camSwing === 'true').length }
  const azimuthTravel = Number(cornerAfter.camAzimuth) - Number(spawn.camAzimuth)
  const summary = { spawnY, spawnAzimuth: spawn.camAzimuth, corner: { position: corner.position, camDist: corner.camDist, camPolar: corner.camPolar, camAzimuth: corner.camAzimuth, camSwing: corner.camSwing }, cornerAfter: { position: cornerAfter.position, camDist: cornerAfter.camDist, camPolar: cornerAfter.camPolar, camAzimuth: cornerAfter.camAzimuth, camSwing: cornerAfter.camSwing, azimuthTravelDeg: (azimuthTravel * 180 / Math.PI).toFixed(1) }, cornerSeries: { samples: cornerSamples.length, minCamDist: Math.min(...cornerSeries.camDist), minCamPolar: Math.min(...cornerSeries.camPolar), maxCamPolar: Math.max(...cornerSeries.camPolar), swingFrames: cornerSeries.swingFrames, azimuthMonotonic: cornerSeries.camAzimuth.every((value, index, all) => index === 0 || Math.sign(azimuthTravel) * (value - all[index - 1]) >= -0.01) }, afterReset: { position: afterReset.position, camAzimuth: afterReset.camAzimuth, camPolar: afterReset.camPolar, camDist: afterReset.camDist }, walking: { anim: walking.anim, facing: walking.facing, position: walking.position }, running: { anim: running.anim, facing: running.facing, position: running.position }, stopped: { anim: stopped.anim, camPolar: stopped.camPolar }, airborne: { anim: airborne.anim, grounded: airborne.grounded, position: airborne.position }, landed: { anim: landed.anim, position: landed.position, camPolar: landed.camPolar, takeoffs: landed.takeoffs, landings: landed.landings }, flips, animSeries, minCamDist: Math.min(...camDistances), forwardFacingShare: facing.filter((value) => value > 0.9).length / facing.length, maxY: Math.max(...samples.map((s) => Number(s.position.split(',')[1]))) }
  console.log('LOCOMOTION', JSON.stringify(summary))
  // Camera swing-around (Polish 2): the glass wall obstructed the default view, the camera swung to the side and never
  // rose toward top-down; the clamp held >= 1.2 m throughout; RESET restored the default view.
  assert.ok(cornerSamples.length >= 20, `corner phase sampled (${cornerSamples.length} samples)`)
  assert.ok(cornerSeries.camDist.some((value) => value < 3), 'the glass wall actually obstructed the camera (clamp/swing path exercised)')
  assert.ok(Math.min(...cornerSeries.camDist) >= 1.2, `camera held >= 1.2 m from the follow target through the swing (min ${Math.min(...cornerSeries.camDist)})`)
  assert.ok(Number(corner.camPolar) > 0.55 && Math.min(...cornerSeries.camPolar) > 0.55, `camera never rose toward top-down: min polar ${Math.min(...cornerSeries.camPolar)} (corner sample ${corner.camPolar})`)
  assert.ok(Math.abs(Number(cornerAfter.camPolar) - Number(spawn.camPolar)) < 0.1, `polar angle kept through the swing (${spawn.camPolar} -> ${cornerAfter.camPolar})`)
  assert.ok(Math.abs(azimuthTravel) >= 60 * Math.PI / 180 && Math.abs(azimuthTravel) <= 100 * Math.PI / 180, `camera swung 60-100 deg around the side (${(azimuthTravel * 180 / Math.PI).toFixed(1)} deg)`)
  assert.ok(summary.cornerSeries.azimuthMonotonic, 'the swing never reversed (no ping-pong)')
  assert.ok(cornerSeries.swingFrames > 0, 'the swing state was active during the corner phase')
  assert.equal(cornerAfter.camSwing, 'false', 'the swing settled on a clear view before the character stopped')
  assert.ok(Number(cornerAfter.camDist) > 2.5, `the side view is clear again (camDist ${cornerAfter.camDist})`)
  assert.ok(Math.abs(Number(afterReset.camAzimuth) - Number(spawn.camAzimuth)) < 0.05 && Math.abs(Number(afterReset.camPolar) - Number(spawn.camPolar)) < 0.05, `RESET POSITION restored the default view (${afterReset.camAzimuth}/${afterReset.camPolar} vs ${spawn.camAzimuth}/${spawn.camPolar})`)
  assert.ok(Math.abs(Number(afterReset.position.split(',')[0])) < 0.05, `RESET POSITION returned to spawn (${afterReset.position})`)
  assert.deepEqual(flips, ['false', 'true'], 'grounded flips false then true exactly once (one takeoff, one landing)')
  assert.equal(landed.takeoffs, '1', 'the animator saw exactly one takeoff edge')
  assert.equal(landed.landings, '1', 'the animator saw exactly one landing edge (one-shot land)')
  // the 220 ms land window can fall between 40 ms samples after the landing screenshot stall, hence the counter above
  assert.ok(inOrder(animSeries, ['walk', 'run', 'airborne', 'land']) || inOrder(animSeries, ['walk', 'run', 'airborne', 'idle']), `anim goes walk -> run -> airborne -> land/idle in order: ${animSeries.join(' > ')}`)
  assert.ok(['land', 'idle'].includes(landed.anim), 'settled after landing')
  assert.ok(Math.min(...camDistances) >= 1.1, `camera never closer than 1.1 m to the follow target (min ${Math.min(...camDistances)})`)
  assert.ok(Math.abs(Number(landed.position.split(',')[1]) - spawnY) < 0.05, `y after landing within 0.05 of spawn (${landed.position} vs ${spawnY})`)
  // steady-state facing (turn-arounds legitimately pass through negative values while the body rotates)
  assert.ok(Number(walking.facing) > 0.9 && Number(running.facing) > 0.9, `model faces its travel direction (walk ${walking.facing}, run ${running.facing})`)
  assert.ok(facing.filter((value) => value > 0.9).length > facing.length * 0.7, 'facing is forward for most of the route')
  assert.equal(walking.anim, 'walk')
  assert.equal(running.anim, 'run')
  assert.equal(airborne.grounded, 'false')
  assert.ok(['jump_takeoff', 'airborne'].includes(airborne.anim), 'never idle in the air')
  // Phase 1 asserted the polar rise + ease-back here; the swing-around keeps the polar angle instead, so the whole route ends at the preferred orbit angle.
  assert.ok(Math.abs(Number(landed.camPolar) - Number(spawn.camPolar)) < 0.1, `route ends at the preferred orbit angle (${spawn.camPolar} -> ${landed.camPolar})`)
}

try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5185', { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await wait(1500)
  await page.screenshot({ path: output + 'branding.png' })
  await click('START RUNWAY')
  await page.waitForSelector('canvas[data-character="sergio"]', { timeout: 30000 })
  assert.equal(await page.$eval('canvas', (c) => c.dataset.quality), 'balanced', 'first run starts on the balanced quality tier (disposable profile: no runway.quality yet)')
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
  // Quality tiers (world/quality.ts): first run is Balanced (dpr <= 1.5, shadows on); the toolbar select switches the
  // live canvas (data-quality, renderer dpr/shadows) and persists the manual choice; Low disables shadows at dpr 1.
  const qualityBefore = await page.$eval('canvas', (c) => ({ ...c.dataset }))
  assert.equal(qualityBefore.qualityManual, 'false', 'nothing chosen by hand yet')
  if (qualityBefore.quality === 'balanced') {
    assert.equal(qualityBefore.qualityShadows, 'true')
    assert.ok(Number(qualityBefore.qualityDpr) <= 1.5 && Number(qualityBefore.qualityDpr) >= 1, `balanced dpr within [1, 1.5] (${qualityBefore.qualityDpr})`)
    assert.equal(qualityBefore.qualityAuto ?? '', '', 'no automatic change recorded')
  } else {
    // Headless SwiftShader can legitimately trip the auto step-down (p50 > 24 ms for two 5 s windows): demand that evidence.
    assert.equal(qualityBefore.quality, 'low', `auto tuning only steps down from balanced (${qualityBefore.quality})`)
    const change = /^balanced>low@(\d+\.\d)$/.exec(qualityBefore.qualityAuto ?? '')
    assert.ok(change && Number(change[1]) > 24 && Number(qualityBefore.qualityWindows) >= 2, `auto step-down recorded with a slow p50 after >= 2 windows (${qualityBefore.qualityAuto}, windows ${qualityBefore.qualityWindows})`)
    assert.equal(qualityBefore.qualityShadows, 'false', 'low tier turned shadows off')
    assert.equal(qualityBefore.qualityDpr, '1.00')
  }
  await page.select('select[aria-label="Render quality"]', 'high')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.quality === 'high' && document.querySelector('canvas')?.dataset.qualityShadows === 'true' && document.querySelector('canvas')?.dataset.qualityManual === 'true', { timeout: 5000 })
  await wait(400)
  const qualityHigh = await page.$eval('canvas', (c) => ({ ...c.dataset }))
  assert.ok(Number(qualityHigh.qualityDpr) >= 1 && Number(qualityHigh.qualityDpr) <= 2, `high dpr = min(devicePixelRatio, 2) (${qualityHigh.qualityDpr})`)
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('runway.quality'), localStorage.getItem('runway.quality.manual')]), ['high', '1'], 'manual choice persisted')
  await page.screenshot({ path: cameraOutput + 'quality-high.png' })
  await page.select('select[aria-label="Render quality"]', 'low')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.quality === 'low' && document.querySelector('canvas')?.dataset.qualityShadows === 'false', { timeout: 5000 })
  await wait(400)
  const qualityLow = await page.$eval('canvas', (c) => ({ ...c.dataset }))
  assert.equal(qualityLow.qualityDpr, '1.00', 'low tier renders at dpr 1')
  assert.ok(Number(qualityLow.qualityDpr) <= Number(qualityHigh.qualityDpr), 'low never renders more pixels than high')
  await page.screenshot({ path: cameraOutput + 'quality-low.png' })
  await page.select('select[aria-label="Render quality"]', 'balanced')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.quality === 'balanced' && document.querySelector('canvas')?.dataset.qualityShadows === 'true', { timeout: 5000 })
  console.log('QUALITY', JSON.stringify({ before: qualityBefore.quality, auto: qualityBefore.qualityAuto, windows: qualityBefore.qualityWindows, lastP50: qualityBefore.qualityP50, highDpr: qualityHigh.qualityDpr, lowDpr: qualityLow.qualityDpr, lowShadows: qualityLow.qualityShadows }))
  await page.evaluate(() => { localStorage.removeItem('runway.quality'); localStorage.removeItem('runway.quality.manual') })
  await openStory()
  await click('Founders only')
  await click('CONTINUE')
  await click('Test the launch')
  await click('CONTINUE')
  await click('OF COURSE')
  await openStory()
  await click('Save every forint')
  await click('CONTINUE')
  await click('Disable the feed')
  await click('CONTINUE')
  await click('WALK THERE')
  await openStory()
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
  console.log('TRAIL', await page.evaluate(() => window.__trail.slice(-40).join('\n')).catch(() => 'n/a'))
  throw error
} finally { await browser.close() }
