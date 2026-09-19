/**
 * LIVE adapter → orchestrator (Lane C / Sadman owns the server; this file is co-owned for the contract).
 * The browser calls Vercel proxy routes (/api/missions/*) which add the server-side ORCH_TOKEN.
 * In local dev, vite.config.ts proxies /api → localhost:8000 directly.
 */
import type { EngineeringAgent, MissionRequest, MissionStatus } from './types'

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')
const headers = { 'Content-Type': 'application/json' }

export class HttpAgent implements EngineeringAgent {
  readonly mode = 'live' as const

  async createTask(req: MissionRequest) {
    const r = await fetch(`${BASE}/api/missions`, { method: 'POST', headers, body: JSON.stringify(req) })
    if (!r.ok) throw new Error(`orchestrator ${r.status}`)
    return r.json()
  }

  async getStatus(id: string): Promise<MissionStatus> {
    const r = await fetch(`${BASE}/api/missions/${id}`, { headers })
    if (!r.ok) throw new Error(`orchestrator ${r.status}`)
    return r.json()
  }

  async cancel(id: string) {
    await fetch(`${BASE}/api/missions/${id}/cancel`, { method: 'POST', headers }).catch(() => {})
  }

  static async healthy(): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2500) })
      return r.ok
    } catch {
      return false
    }
  }
}
