// POST /api/missions (create). Self-contained copy of [[...path]].ts: Vercel neither resolves the bare
// /api/missions path via the catch-all nor bundles an import from a bracketed filename.
// Vercel serverless proxy: browser -> Railway orchestrator.
// The browser only ever calls same-origin /api/missions/*; ORCH_TOKEN never reaches it.
// Secrets read here: ORCH_URL, ORCH_TOKEN (server-only, never VITE_-prefixed).

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const orchUrl = process.env.ORCH_URL
  const orchToken = process.env.ORCH_TOKEN
  if (!orchUrl) {
    return json({ error: 'orchestrator not configured' }, 503)
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/missions/, '') || '/'
  const target = `${orchUrl.replace(/\/$/, '')}/api/missions${path}${url.search}`

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (orchToken) headers.set('x-runway-key', orchToken)

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text()

  let upstream: Response
  try {
    upstream = await fetch(target, { method: req.method, headers, body, signal: AbortSignal.timeout(15000) })
  } catch {
    return json({ error: 'orchestrator unreachable' }, 502)
  }

  const respBody = await upstream.text()
  return new Response(respBody, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
