// Browser speech synthesis for SCRIPTED founder lines, one distinct voice per character.
// GPT-Live (Azure) is locked to a single voice per session, so live conversation is Sergio /
// the Investor only; Sadman and Kirill are heard through these local voices. Free, no backend.
// Accent is best-effort: an es-* voice reading English gives a Spanish-accented delivery, etc.

import { subscribeSpeak, type SpeakPayload } from '../state/voiceBridge'

type Who = 'kirill' | 'sadman' | 'sergio' | 'investor' | string

interface Profile { langs: string[]; fallbackLangs: string[]; pitch: number; rate: number; preferMale?: boolean }

const PROFILES: Record<string, Profile> = {
  sadman: { langs: ['en-IN', 'hi-IN', 'bn'], fallbackLangs: ['en-GB', 'en'], pitch: 0.95, rate: 1.05 },
  kirill: { langs: ['ru-RU', 'ru'], fallbackLangs: ['en-GB', 'en'], pitch: 0.8, rate: 0.98 },
  sergio: { langs: ['es-CO', 'es-MX', 'es-US', 'es-419', 'es-ES', 'es'], fallbackLangs: ['en-US', 'en'], pitch: 1.1, rate: 1.15 },
  investor: { langs: ['en-GB'], fallbackLangs: ['en'], pitch: 0.9, rate: 0.95 },
}

const FEMALE_HINT = /\b(samantha|victoria|karen|moira|tessa|fiona|veena|zira|susan|kate|serena|allison|ava|joana|monica|paulina|milena|katya|anna|lekha|female)\b/i

let muted = false
let enabled = true
const seenTags = new Set<string>()
const queue: SpeechSynthesisUtterance[] = []
let speaking = false
const voiceCache = new Map<string, SpeechSynthesisVoice | null>()

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

function pickVoice(who: Who): SpeechSynthesisVoice | null {
  const key = String(who)
  if (voiceCache.has(key)) return voiceCache.get(key)!
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null // not loaded yet; do not cache
  const p = PROFILES[key] ?? PROFILES.sergio
  const byLang = (langs: string[]) => {
    for (const l of langs) {
      const c = voices.filter((v) => v.lang.toLowerCase().startsWith(l.toLowerCase()))
      if (!c.length) continue
      // Prefer male-sounding names (all founders are men), then local/default voices.
      const male = c.filter((v) => !FEMALE_HINT.test(v.name))
      const pool = male.length ? male : c
      return pool.find((v) => v.localService) ?? pool[0]
    }
    return null
  }
  const v = byLang(p.langs) ?? byLang(p.fallbackLangs) ?? voices.find((x) => x.default) ?? voices[0] ?? null
  voiceCache.set(key, v)
  return v
}

function pump() {
  if (speaking || !queue.length || muted) return
  const u = queue.shift()!
  speaking = true
  const done = () => { speaking = false; pump() }
  u.onend = done
  u.onerror = done
  try { window.speechSynthesis.speak(u) } catch { done() }
}

/** Speak scripted lines, each in its character's voice. Deduped by tag. */
export function ttsSpeak(p: SpeakPayload): void {
  if (!supported() || !enabled) return
  if (seenTags.has(p.tag)) return
  seenTags.add(p.tag)
  for (const line of p.lines) {
    const who = line.who as Who
    const prof = PROFILES[who] ?? PROFILES.sergio
    const u = new SpeechSynthesisUtterance(line.text)
    const v = pickVoice(who)
    if (v) { u.voice = v; u.lang = v.lang }
    u.pitch = prof.pitch
    u.rate = prof.rate
    u.volume = 1
    queue.push(u)
  }
  pump()
}

export function ttsSetMuted(m: boolean): void {
  muted = m
  if (m) { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } speaking = false }
  else pump()
}

/** Stop everything and forget dedupe tags (restart). */
export function ttsReset(): void {
  queue.length = 0
  seenTags.clear()
  speaking = false
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}

export function ttsSetEnabled(on: boolean): void { enabled = on; if (!on) ttsReset() }

let inited = false
/** Wire scripted lines -> local speech. Safe to call once at app start. */
export function initTts(): () => void {
  if (inited || !supported()) return () => {}
  inited = true
  // Voice list loads async in Chrome; clear cache when it changes.
  try { window.speechSynthesis.onvoiceschanged = () => voiceCache.clear() } catch { /* ignore */ }
  const unsub = subscribeSpeak(ttsSpeak)
  return () => { unsub(); inited = false }
}

/** For debugging in the console: which system voice each founder resolved to. */
export function ttsVoiceReport(): Record<string, string> {
  if (!supported()) return {}
  const out: Record<string, string> = {}
  for (const who of Object.keys(PROFILES)) { const v = pickVoice(who); out[who] = v ? `${v.name} (${v.lang})` : 'none' }
  return out
}
