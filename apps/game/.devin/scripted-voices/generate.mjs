import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises'
import { parseArgs, parseEnv } from 'node:util'
import { pathToFileURL } from 'node:url'
import * as skit from '../../src/events/skit.ts'
import { CAMPAIGN_EVENTS } from '../../src/events/campaign.ts'
import { voices, format, version, ssml } from './config.mjs'

const root = new URL('../../', import.meta.url)
const manifestPath = new URL('./manifest.json', import.meta.url)
const sha = data => createHash('sha256').update(data).digest('hex')

export function speechUrl(endpoint, region) {
  if (endpoint) {
    let url
    try { url = new URL(endpoint.trim()) } catch { throw new Error('Invalid AZURE_SPEECH_ENDPOINT') }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !/^[a-z0-9-]+\.cognitiveservices\.azure\.com$/.test(url.hostname) || !['/', '/tts/cognitiveservices/v1'].includes(url.pathname)) throw new Error('Use the HTTPS Azure Speech resource root as AZURE_SPEECH_ENDPOINT')
    return `${url.origin}/tts/cognitiveservices/v1`
  }
  if (!region || !/^[a-z][a-z0-9]{1,40}$/.test(region)) throw new Error('Set AZURE_SPEECH_ENDPOINT or a valid AZURE_SPEECH_REGION')
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`
}

export function collectLines(value, character, found = new Map()) {
  if (!value || typeof value !== 'object') return [...found.values()]
  if (value.who === character && typeof value.text === 'string') found.set(value.text, { who: character, text: value.text })
  else for (const child of Object.values(value)) collectLines(child, character, found)
  return [...found.values()]
}

export function plannedClips(character) {
  if (!Object.hasOwn(voices, character)) throw new Error('Use --character sergio or kirill')
  return collectLines([skit, CAMPAIGN_EVENTS], character).map(line => {
    const body = ssml(line.who, line.text)
    const id = sha(JSON.stringify({ version, format, body })).slice(0, 24)
    return { ...line, voice: voices[character].name, path: `/assets/voices/${character}-${id}.wav`, body }
  })
}

/** Verify the actual PCM payload; a 200 HTML denial page or silent WAV is not a clip. */
export function inspectWav(data) {
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected WAV audio')
  let pcm, fmt
  for (let at = 12; at + 8 <= data.length;) {
    const size = data.readUInt32LE(at + 4), start = at + 8
    if (start + size > data.length) throw new Error('Truncated WAV')
    const kind = data.toString('ascii', at, at + 4)
    if (kind === 'fmt ' && size >= 16) fmt = data.subarray(start, start + size)
    if (kind === 'data') pcm = data.subarray(start, start + size)
    at = start + size + (size % 2)
  }
  if (!fmt || !pcm || fmt.readUInt16LE(0) !== 1 || fmt.readUInt16LE(2) !== 1 || fmt.readUInt32LE(4) !== 24000 || fmt.readUInt16LE(14) !== 16 || pcm.length < 4800 || pcm.length % 2) throw new Error('Invalid 24 kHz mono PCM audio')
  let peak = 0, energy = 0
  for (let i = 0; i < pcm.length; i += 2) { const v = pcm.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(v)); energy += v * v }
  const rms = Math.sqrt(energy / (pcm.length / 2))
  if (peak < 0.001 || rms < 0.0001) throw new Error('Silent recording; not publishing')
  return { seconds: pcm.length / 48000, peak, rms }
}

async function atomicWrite(path, contents) {
  const tmp = new URL(`${path.href}.tmp`)
  await writeFile(tmp, contents)
  await rename(tmp, path)
}

async function main() {
  const { values } = parseArgs({ options: { character: { type: 'string', default: 'sergio' }, execute: { type: 'boolean', default: false }, limit: { type: 'string' } } })
  const plans = plannedClips(values.character)
  const limit = values.limit === undefined ? plans.length : Number(values.limit)
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.version !== 1 || !Array.isArray(manifest.clips)) throw new Error('Invalid voice manifest')
  const todo = []
  for (const plan of plans) {
    const existing = manifest.clips.find(clip => clip.who === plan.who && clip.text === plan.text && clip.path === plan.path)
    if (existing) {
      try {
        const data = await readFile(new URL(`public${plan.path}`, root))
        if (sha(data) === existing.sha256) { inspectWav(data); continue }
      } catch { /* Recreate a missing/corrupt file with an explicit --execute run. */ }
    }
    todo.push(plan)
  }
  console.log(JSON.stringify({ character: values.character, voice: voices[values.character].name, lines: plans.length, validCached: plans.length - todo.length, remaining: todo.length, thisRun: Math.min(limit, todo.length), mode: values.execute ? 'generate' : 'dry-run' }, null, 2))
  if (!values.execute || !todo.length) return
  let local = {}
  try { local = parseEnv(await readFile(new URL('.env.local', root), 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
  const key = process.env.AZURE_SPEECH_KEY || local.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION || local.AZURE_SPEECH_REGION
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT || local.AZURE_SPEECH_ENDPOINT
  if (!key) throw new Error('Set AZURE_SPEECH_KEY in apps/game/.env.local. GPT-Live credentials are not used.')
  const url = speechUrl(endpoint, region)
  const lockPath = new URL('./generate.lock', import.meta.url)
  let lock
  try { lock = await open(lockPath, 'wx') } catch (e) { if (e.code === 'EEXIST') throw new Error('Another generation run holds generate.lock. Do not run concurrently.'); throw e }
  try {
    await mkdir(new URL('public/assets/voices/', root), { recursive: true })
    for (const [i, plan] of todo.slice(0, limit).entries()) {
      console.log(`${i + 1}/${Math.min(limit, todo.length)} ${plan.path}`)
      const response = await fetch(url, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': format, 'User-Agent': 'RUNWAY-scripted-voices' },
        body: plan.body,
      })
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Azure Speech HTTP ${response.status}; stopped, no retries`) }
      const data = Buffer.from(await response.arrayBuffer())
      const measurements = inspectWav(data)
      await atomicWrite(new URL(`public${plan.path}`, root), data)
      const { body: _body, ...clip } = plan
      manifest.clips = manifest.clips.filter(old => old.who !== clip.who || old.text !== clip.text)
      manifest.clips.push({ ...clip, sha256: sha(data), ...measurements, format, version, generatedAt: new Date().toISOString() })
      await atomicWrite(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`Saved ${measurements.seconds.toFixed(1)}s; non-silent PCM. Listening still required.`)
    }
    console.log('Audio and manifest saved. Rebuild the game before preview/deployment.')
  } finally { await lock.close(); await unlink(lockPath) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.cause?.code || error.message || 'Generation failed'); process.exitCode = 1 })
}
