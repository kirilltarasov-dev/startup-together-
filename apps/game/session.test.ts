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
    const body = JSON.parse(requestBody) as { session: { instructions: string; delegation: { responses: { tool_choice: string; instructions: string } } } }
    const responses = body.session.delegation.responses
    assert.equal(responses.tool_choice, 'auto')
    assert.match(responses.instructions, /Never guess, pick the closest/)
    assert.match(responses.instructions, /bare mention of Devin never selects send_devin/)
    assert.match(body.session.instructions, /wait for the game.s scripted reaction/)
    assert.doesNotMatch(body.session.instructions, /say one short line while the backend works/)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv('AZURE_OPENAI_ENDPOINT', env.endpoint)
    restoreEnv('AZURE_OPENAI_API_KEY', env.key)
    restoreEnv('AZURE_LIVE_DEPLOYMENT', env.live)
    restoreEnv('AZURE_RESPONSES_DEPLOYMENT', env.responses)
  }
})

test('allows thirty sessions per shared IP without extending the window for rejected retries', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  const env = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    key: process.env.AZURE_OPENAI_API_KEY,
    live: process.env.AZURE_LIVE_DEPLOYMENT,
    responses: process.env.AZURE_RESPONSES_DEPLOYMENT,
  }
  let now = 1000
  let calls = 0
  Date.now = () => now
  process.env.AZURE_OPENAI_ENDPOINT = 'https://voice.example.test/'
  process.env.AZURE_OPENAI_API_KEY = 'test-key'
  process.env.AZURE_LIVE_DEPLOYMENT = 'live-test'
  process.env.AZURE_RESPONSES_DEPLOYMENT = 'router-test'
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ sdp: 'v=0\r\n' }), { status: 200 })
  }
  const request = () => handler(new Request('https://runway.test/api/voice/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.74' },
    body: JSON.stringify({ sdp: 'v=0\r\n' }),
  }))
  try {
    assert.equal((await request()).status, 200)
    now = 2000
    for (let i = 1; i < 30; i++) assert.equal((await request()).status, 200)
    now = 3000
    assert.equal((await request()).status, 429)
    now = 601000
    assert.equal((await request()).status, 200)
    assert.equal(calls, 31)
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
    restoreEnv('AZURE_OPENAI_ENDPOINT', env.endpoint)
    restoreEnv('AZURE_OPENAI_API_KEY', env.key)
    restoreEnv('AZURE_LIVE_DEPLOYMENT', env.live)
    restoreEnv('AZURE_RESPONSES_DEPLOYMENT', env.responses)
  }
})
