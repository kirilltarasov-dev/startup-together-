/**
 * Vercel serverless proxy: /api/missions/* -> Railway orchestrator, adding the server-side X-Runway-Key.
 * The browser never holds ORCH_TOKEN. Env (Vercel project settings, NOT VITE_-prefixed):
 *   ORCH_URL   e.g. https://startup-together-production.up.railway.app
 *   ORCH_TOKEN same value as the Railway ORCH_TOKEN variable
 * Lane C (Sadman) owns this file; see docs/LANE_C_SADMAN.md "VERIFY BEFORE HANDOFF".
 */
export const config = { runtime: 'nodejs' }

const ORCH_URL = (process.env.ORCH_URL ?? '').replace(/\/$/, '')
const ORCH_TOKEN = process.env.ORCH_TOKEN ?? ''
const ALLOWED = /^\/api\/missions(\/[A-Za-z0-9_-]{1,64}(\/cancel|\/cache)?)?$/

async function proxy(req: Request): Promise<Response> {
  if (!ORCH_URL) return json({ detail: 'ORCH_URL not configured on Vercel' }, 503)
  const url = new URL(req.url)
  if (!ALLOWED.test(url.pathname)) return json({ detail: 'not found' }, 404)

  const upstream = await fetch(`${ORCH_URL}${url.pathname}`, {
    method: req.method,
    headers: { 'Content-Type': 'application/json', 'X-Runway-Key': ORCH_TOKEN },
    body: req.method === 'POST' ? await req.text() : undefined,
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null)
  if (!upstream) return json({ detail: 'orchestrator unreachable' }, 502)

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
  })
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export const GET = proxy
export const POST = proxy
