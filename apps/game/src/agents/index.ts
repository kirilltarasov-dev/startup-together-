import { HttpAgent } from './httpAgent'
import { MOCK_RECORDING, ReplayAgent, type Recording } from './mockAgent'
import type { EngineeringAgent, Mode } from './types'

export type { Mode }

export const envMode: Mode = (import.meta.env.VITE_AGENT_MODE as Mode | undefined) ?? 'mock'

let cachedRun: Recording | null | undefined

/** A CACHED REAL RUN exists only if Lane C committed cache/optimize_feed.json (served from public/cache/). */
export async function loadCachedRun(): Promise<Recording | null> {
  if (cachedRun !== undefined) return cachedRun
  try {
    const r = await fetch('/cache/optimize_feed.json', { signal: AbortSignal.timeout(2500) })
    cachedRun = r.ok ? ((await r.json()) as Recording) : null
  } catch {
    cachedRun = null
  }
  return cachedRun
}

/**
 * Resolve an agent for the requested mode. Falls back honestly:
 * live unreachable → cached (if a real run exists) → mock. The returned agent's `.mode` is the truth; show it.
 */
export async function makeAgent(mode: Mode = envMode): Promise<EngineeringAgent> {
  if (mode === 'live') {
    if (await HttpAgent.healthy()) return new HttpAgent()
    console.warn('[runway] orchestrator unreachable → trying cached real run')
    mode = 'cached'
  }
  if (mode === 'cached') {
    const rec = await loadCachedRun()
    if (rec) return new ReplayAgent('cached', rec)
    console.warn('[runway] no cached real run → mock')
  }
  return new ReplayAgent('mock', MOCK_RECORDING, 1.5)
}
