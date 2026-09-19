// Vercel serverless proxy: browser -> Railway orchestrator /api/health.
// No secret required for a health check, but we still avoid exposing ORCH_URL to the browser.

export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const orchUrl = process.env.ORCH_URL
  if (!orchUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'orchestrator not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const r = await fetch(`${orchUrl.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(5000) })
    const body = await r.text()
    return new Response(body, { status: r.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'orchestrator unreachable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
