import assert from 'node:assert/strict'
import test from 'node:test'
import handler from './api/voice/session.ts'

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

test('mints an auto-choice router that refuses to guess', async () => {
  const originalFetch = globalThis.fetch
  const env = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY,
    live: process.env.AZURE_LIVE_DEPLOYMENT,
    responses: process.env.AZURE_RESPONSES_DEPLOYMENT,
  }
  let requestBody = ''
  process.env.AZURE_OPENAI_ENDPOINT = 'https://voice.example.test/'
  process.env.AZURE_OPENAI_API_KEY = 'test-key'
  process.env.AZURE_LIVE_DEPLOYMENT = 'live-test'
  process.env.AZURE_RESPONSES_DEPLOYMENT = 'router-test'
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body)
    return new Response(JSON.stringify({ sdp: 'v=0\r\n' }), { status: 200 })
  }

  try {
    const response = await handler(new Request('https://runway.test/api/voice/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sdp: 'v=0\r\n' }),
    }))
    assert.equal(response.status, 200)
    const body = JSON.parse(requestBody) as { session: { delegation: { responses: { tool_choice: string; instructions: string } } } }
    const responses = body.session.delegation.responses
    assert.equal(responses.tool_choice, 'auto')
    assert.match(responses.instructions, /Never guess, pick the closest/)
    assert.match(responses.instructions, /bare mention of Devin never selects send_devin/)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv('AZURE_OPENAI_ENDPOINT', env.endpoint)
    restoreEnv('AZURE_OPENAI_API_KEY', env.key)
    restoreEnv('AZURE_LIVE_DEPLOYMENT', env.live)
    restoreEnv('AZURE_RESPONSES_DEPLOYMENT', env.responses)
  }
})
