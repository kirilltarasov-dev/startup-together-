/** Vercel proxy for the orchestrator health probe used by HttpAgent.healthy(). No secrets needed. */
export const config = { runtime: 'nodejs' }

export async function GET(): Promise<Response> {
  const base = (process.env.ORCH_URL ?? '').replace(/\/$/, '')
  if (!base) return Response.json({ ok: false, detail: 'ORCH_URL not configured' }, { status: 503 })
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(4000) })
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false, detail: 'orchestrator unreachable' }, { status: 502 })
  }
}
