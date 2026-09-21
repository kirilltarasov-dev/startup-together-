import assert from 'node:assert/strict'
import test from 'node:test'
import { isContinueCommand, matchChoice } from './src/voice/choiceMatch.ts'

const E04_CHOICES = [
  { id: 'send_devin', label: 'Send Devin' },
  { id: 'disable_feed', label: 'Disable the feed' },
]

test('matches direct whole-utterance commands', () => {
  assert.equal(matchChoice('We should focus on founders.', [{ id: 'focused', label: 'Founders only' }, { id: 'broad', label: 'Everyone with a pitch' }]), 'focused')
  assert.equal(matchChoice('Please ship tonight.', [{ id: 'careful', label: 'Test the launch' }, { id: 'rush', label: 'Ship tonight' }]), 'rush')
  assert.equal(matchChoice('Tell Devin to fix the feed.', E04_CHOICES), 'send_devin')
  assert.equal(matchChoice('Turn off the feed now.', E04_CHOICES), 'disable_feed')
  assert.equal(isContinueCommand('Okay, continue.'), true)
})

test('rejects questions, negation, ambiguity, and bare Devin mentions', () => {
  assert.equal(matchChoice('Should we send Devin?', E04_CHOICES), null)
  assert.equal(matchChoice("Don't send Devin.", E04_CHOICES), null)
  assert.equal(matchChoice('Maybe send Devin or disable the feed.', E04_CHOICES), null)
  assert.equal(matchChoice('Devin.', E04_CHOICES), null)
  assert.equal(matchChoice('We heard Devin is available.', E04_CHOICES), null)
  assert.equal(isContinueCommand('What happens next?'), false)
  assert.equal(isContinueCommand('Do not continue.'), false)
})
