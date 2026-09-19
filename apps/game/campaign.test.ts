import assert from 'node:assert/strict'
import test from 'node:test'
import { CAMPAIGN_EVENTS, campaignEnding, campaignEventAt } from './src/events/campaign.ts'
import { EVENTS } from './src/events/skit.ts'
import { applyEffects } from './src/engine/effects.ts'
import { currentEvent, eventSequence, resolveChoice, buildVoiceContext } from './src/engine/engine.ts'
import { initialState, useGame } from './src/state/gameStore.ts'
import { CAMPAIGN_SAVE_KEY, decodeCampaignSave, saveCampaign } from './src/state/campaignSave.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value) },
} })

test('demo stays five decisions; campaign has 35 unique encounters and one mission', () => {
  assert.equal(eventSequence(initialState()).length, 5)
  assert.equal(CAMPAIGN_EVENTS.length, 35)
  assert.equal(new Set(CAMPAIGN_EVENTS.map((e) => e.id)).size, 35)
  assert.equal(CAMPAIGN_EVENTS.flatMap((e) => e.choices).filter((c) => c.engineeringMission).length, 1)
  assert.deepEqual(CAMPAIGN_EVENTS.filter((e) => e.voice).map((e) => e.id), ['E01', 'E04', 'E05'])
  for (const event of CAMPAIGN_EVENTS) {
    assert.ok(event.dialogue.length >= 3)
    assert.ok(event.choices.length >= 2)
    assert.equal(new Set(event.choices.map((c) => c.id)).size, event.choices.length)
    for (const choice of event.choices) assert.ok(choice.effects || choice.engineeringMission)
  }
})

test('earlier promises and real mission outcome select the later encounter', () => {
  const state = initialState()
  const support = CAMPAIGN_EVENTS.findIndex((e) => e.id === 'C8')
  assert.equal(campaignEventAt(support, state)?.title, 'The support inbox remembers')
  state.flags.overpromised = true
  assert.equal(campaignEventAt(support, state)?.title, 'Your trailer has become a contract')
  const report = CAMPAIGN_EVENTS.findIndex((e) => e.id === 'C12')
  state.missionOutcome = 'success'
  assert.match(campaignEventAt(report, state)!.title, /fix is real/)
  state.missionOutcome = 'failure'
  assert.equal(campaignEventAt(report, state)?.title, 'The morning after the incident')
})

test('choices apply once and stale events are rejected', () => {
  useGame.getState().start('campaign')
  const event = currentEvent(useGame.getState())!
  assert.ok(resolveChoice(event, 'focused'))
  assert.equal(useGame.getState().health, 60)
  assert.equal(resolveChoice(event, 'broad'), null)
  assert.equal(useGame.getState().health, 60)
  assert.equal(resolveChoice(EVENTS[1], 'rush'), null)
})

test('entry effects survive remount without another viral spike or calendar charge', () => {
  useGame.getState().start('campaign')
  useGame.getState().enterEvent('E04', { users: 800, health: -25 })
  useGame.getState().enterEvent('E04', { users: 800, health: -25 })
  assert.equal(useGame.getState().users, 800)
  assert.equal(useGame.getState().health, 30)
})

test('campaign cashflow advances on encounters, not wall-clock waiting; demo is unchanged', () => {
  const state = { ...initialState(), mode: 'campaign' as const, revenue: 5, dailyBurn: 3 }
  assert.equal(applyEffects(state, { days: 2 }).cash, 41)
  assert.equal(applyEffects(state, {}).cash, 37)
  assert.equal(applyEffects({ ...state, mode: 'demo' }, { days: 2 }).cash, 37)
  const result = applyEffects(state, { health: -1000, morale: 200, debt: 200, trust: -100, cash: -1000 })
  assert.equal(result.health, 0)
  assert.equal(result.morale, 100)
  assert.equal(result.cash, 0)
})

test('save roundtrip keeps choice history but never restores arbitrary properties', () => {
  useGame.getState().start('campaign')
  resolveChoice(currentEvent(useGame.getState())!, 'focused')
  const state = useGame.getState()
  assert.equal(saveCampaign(state), true)
  const text = storage.get(CAMPAIGN_SAVE_KEY)!
  const loaded = decodeCampaignSave(text, initialState())!
  assert.equal(loaded.health, state.health)
  assert.equal(loaded.resolved.E01, 'focused')
  assert.equal(loaded.runId, state.runId)
  assert.equal('start' in loaded, false)
  assert.equal(decodeCampaignSave('{broken', initialState()), null)
  assert.equal(decodeCampaignSave(JSON.stringify({ version: 1, state: { ...state, eventIndex: 999 } }), initialState()), null)
  assert.equal(decodeCampaignSave(JSON.stringify({ version: 1, state: { ...state, health: '100' } }), initialState()), null)
})

test('resuming a pending mission takes the disclosed workaround, never creates a task', () => {
  useGame.getState().start('campaign')
  const index = CAMPAIGN_EVENTS.findIndex((event) => event.id === 'E04')
  useGame.getState().set({ eventIndex: index })
  useGame.getState().enterEvent('E04', { users: 800, health: -25 })
  useGame.getState().markResolved('E04', 'send_devin')
  useGame.getState().setScreen('devin')
  useGame.getState().restart()
  assert.equal(useGame.getState().resumeCampaign(), true)
  assert.equal(useGame.getState().screen, 'play')
  assert.equal(useGame.getState().missionOutcome, 'skipped')
  assert.equal(useGame.getState().flags.interruptedMission, true)
  assert.equal(useGame.getState().users, 500)
  const health = useGame.getState().health
  useGame.getState().restart()
  useGame.getState().resumeCampaign()
  assert.equal(useGame.getState().health, health)
})

test('100 deterministic paths finish with valid resources and legal voice contexts', () => {
  const endings = new Set<string>()
  for (let seed = 1; seed <= 100; seed++) {
    useGame.getState().start('campaign')
    let random = seed
    for (let index = 0; index < CAMPAIGN_EVENTS.length; index++) {
      useGame.getState().set({ eventIndex: index })
      const state = useGame.getState()
      const event = currentEvent(state)!
      state.enterEvent(event.id, event.onEnter)
      const context = buildVoiceContext(event, state)
      assert.equal(!!context, !!event.voice)
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0
      const choice = event.choices[random % event.choices.length]
      assert.ok(resolveChoice(event, choice.id))
      if (choice.engineeringMission) {
        state.apply({ health: seed % 2 ? 40 : -15, users: seed % 2 ? 50 : -150 })
        state.set({ missionOutcome: seed % 2 ? 'success' : 'failure' })
      }
      const next = useGame.getState()
      for (const key of ['cash', 'users', 'health', 'morale', 'trust', 'debt', 'day'] as const) assert.ok(Number.isFinite(next[key]) && next[key] >= 0)
    }
    assert.equal(Object.keys(useGame.getState().resolved).length, 35)
    endings.add(campaignEnding(useGame.getState()))
  }
  assert.ok(endings.size >= 3, `Only ${endings.size} endings reached`)
  console.log('Campaign endings reached:', [...endings])
})
