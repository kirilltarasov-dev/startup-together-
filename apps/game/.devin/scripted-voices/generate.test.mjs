import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectWav, plannedClips, speechUrl } from './generate.mjs'
import { ssml } from './config.mjs'

test('Speech endpoint supports custom resources and refuses credential forwarding outside Azure', () => {
  assert.equal(speechUrl('https://kirilltarasov-0677-resource.cognitiveservices.azure.com/'), 'https://kirilltarasov-0677-resource.cognitiveservices.azure.com/tts/cognitiveservices/v1')
  assert.equal(speechUrl(undefined, 'westeurope'), 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1')
  for (const endpoint of ['http://example.com', 'https://example.com/', 'https://foo.cognitiveservices.azure.com.evil.org/', 'https://user:pass@foo.cognitiveservices.azure.com/', 'https://foo.cognitiveservices.azure.com/?key=secret']) assert.throws(() => speechUrl(endpoint))
})

test('Sergio audio plan covers original and campaign variants without translating or duplicates', () => {
  const clips = plannedClips('sergio')
  assert.ok(clips.some(c => c.text === 'Then we ship your laptop.'))
  assert.ok(clips.some(c => c.text === 'She accepted. I am deleting several adjectives.'))
  assert.equal(new Set(clips.map(c => c.text)).size, clips.length)
  assert.ok(clips.every(c => c.voice === 'es-CO-GonzaloNeural' && c.who === 'sergio'))
  assert.equal(ssml('sergio', 'A & B < C'), '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-CO"><voice name="es-CO-GonzaloNeural">A &amp; B &lt; C</voice></speak>')
  assert.throws(() => plannedClips('unknown'))
  assert.deepEqual(plannedClips('sergio'), clips, 'stable cache filenames')
})

test('only valid non-silent PCM WAV files may enter the manifest', () => {
  const wav = Buffer.alloc(44 + 4800)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4800, 40)
  assert.throws(() => inspectWav(wav), /Silent/)
  for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(Math.sin(i) * 1000), i)
  assert.equal(inspectWav(wav).seconds, 0.1)
  assert.throws(() => inspectWav(wav.subarray(0, 70)), /Truncated/)
  assert.throws(() => inspectWav(Buffer.from('<html>Access denied</html>')), /Expected WAV/)
})
