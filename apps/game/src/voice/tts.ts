// Browser speech synthesis for SCRIPTED founder lines, one distinct voice per character.
// GPT-Live (Azure) is locked to a single voice per session, so live conversation is Sergio /
// the Investor only; Sadman and Kirill are heard through these local voices. Free, no backend.
// Restore earlier locale preferences; pronunciation depends on installed voices.
// Never simulate accents with heavy pitch shifts or select novelty voices.
// Sequencing (one speaker at a time) lives in stageManager.ts; this module plays ONE line.

type Who = 'kirill' | 'sadman' | 'sergio' | 'investor' | string

interface Profile {
  langs: string[]
  fallbackLangs: string[]
  pitch: number
  rate: number
}

const PROFILES: Record<string, Profile> = {
  sadman: { langs: ['en-IN'], fallbackLangs: ['en-GB', 'en'], pitch: 1, rate: 1 },
  kirill: { langs: ['ru-RU', 'ru'], fallbackLangs: ['en-GB', 'en'], pitch: 1, rate: 0.98 },
  sergio: { langs: ['es-CO', 'es-MX', 'es-US', 'es-419', 'es-ES', 'es'], fallbackLangs: ['en-US', 'en'], pitch: 1, rate: 1.05 },
  investor: { langs: ['en-GB'], fallbackLangs: ['en'], pitch: 1, rate: 0.98 },
}

const FEMALE_HINT = /\b(samantha|victoria|karen|moira|tessa|fiona|veena|zira|susan|kate|serena|allison|ava|joana|monica|paulina|milena|katya|anna|lekha|female)\b/i
/** macOS novelty / Eloquence voices and "Compact" variants sound robotic; never pick them. */
const EXCLUDE_HINT = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bells|boing|bubbles|cellos|wobble|zarvox|trinoids|whisper|bad news|good news|jester|organ|superstar|bahh|albert|fred|junior|ralph|kathy)\b|compact/i
/** Quality hints, best first. */
const PREFER_HINTS = ['google', 'enhanced', 'premium', 'natural', 'siri']

let muted = false
let enabled = true
const voiceCache = new Map<string, { voice: SpeechSynthesisVoice | null; rule: string }>()
const pending = new Set<() => void>()

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

/** Lower is better. Excluded voices sort last (score >= 100). */
function rank(v: SpeechSynthesisVoice): number {
  if (EXCLUDE_HINT.test(v.name)) return 100
  const n = v.name.toLowerCase()
  const hint = PREFER_HINTS.findIndex((h) => n.includes(h))
  let s = hint >= 0 ? hint : PREFER_HINTS.length
  if (!v.localService) s += 10
  if (FEMALE_HINT.test(v.name)) s += 20 // all founders are men
  return s
}

function bestForLangs(voices: SpeechSynthesisVoice[], langs: string[]): { voice: SpeechSynthesisVoice; lang: string } | null {
  for (const l of langs) {
    const c = voices.filter((v) => {
      const lang = v.lang.toLowerCase().replace(/_/g, '-')
      return !EXCLUDE_HINT.test(v.name) && (lang === l.toLowerCase() || lang.startsWith(`${l.toLowerCase()}-`))
    })
    if (!c.length) continue
    const sorted = [...c].sort((a, b) => rank(a) - rank(b))
    return { voice: sorted[0], lang: l }
  }
  return null
}

function resolve(who: Who): { voice: SpeechSynthesisVoice | null; rule: string; pitch: number; rate: number } {
  const key = String(who)
  const p = PROFILES[key] ?? PROFILES.sergio
  const cached = voiceCache.get(key)
  if (cached) return { ...cached, pitch: p.pitch, rate: p.rate }
  const voices = supported() ? window.speechSynthesis.getVoices() : []
  if (!voices.length) return { voice: null, rule: 'no voices loaded', pitch: p.pitch, rate: p.rate } // do not cache
  let hit = bestForLangs(voices, p.langs)
  let rule = hit ? `primary ${hit.lang}` : ''
  if (!hit) { hit = bestForLangs(voices, p.fallbackLangs); rule = hit ? `fallback ${hit.lang} (requested accent unavailable)` : '' }
  const voice = hit?.voice ?? null
  if (!voice) rule = 'unavailable: no acceptable voice'
  voiceCache.set(key, { voice, rule })
  return { voice, rule, pitch: p.pitch, rate: p.rate }
}

/** Speak ONE line in `who`'s voice; resolves on end/error/cancel, or at once if unsupported/muted. */
export function speakLine(who: string, text: string): Promise<void> {
  if (!supported() || !enabled || muted || !text.trim()) return Promise.resolve()
  return new Promise<void>((done) => {
    const r = resolve(who)
    if (!r.voice) { done(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.voice = r.voice
    u.lang = r.voice.lang
    u.pitch = r.pitch
    u.rate = r.rate
    u.volume = 1
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      pending.delete(finish)
      u.onend = null
      u.onerror = null
      done()
    }
    pending.add(finish)
    u.onend = finish
    u.onerror = finish
    try { window.speechSynthesis.speak(u) } catch { finish() }
  })
}

export function ttsSetMuted(m: boolean): void {
  muted = m
  if (m) ttsCancel()
}

export function ttsIsMuted(): boolean { return muted }

/** Cancellation need not emit browser events; settle our own waiters. */
export function ttsCancel(): void {
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
  for (const finish of [...pending]) finish()
}

/** Stop everything (restart). */
export function ttsReset(): void {
  ttsCancel()
}

export function ttsSetEnabled(on: boolean): void { enabled = on; if (!on) ttsReset() }

let inited = false
/** Voice-list warmup only (Chrome loads voices async). Playback is driven by stageManager.ts. */
export function initTts(): () => void {
  if (inited || !supported()) return () => {}
  inited = true
  const onVoicesChanged = () => voiceCache.clear()
  try {
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
    window.speechSynthesis.getVoices()
  } catch { /* ignore */ }
  return () => {
    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
    voiceCache.clear()
    inited = false
    ttsCancel()
  }
}

/** For debugging in the console: which system voice each founder resolved to, and by which rule. */
export function ttsVoiceReport(): Record<string, string> {
  if (!supported()) return {}
  const out: Record<string, string> = {}
  for (const who of Object.keys(PROFILES)) {
    const r = resolve(who)
    out[who] = r.voice ? `${r.voice.name} (${r.voice.lang}) [${r.rule}; pitch ${r.pitch} rate ${r.rate}]` : `none [${r.rule}]`
  }
  return out
}
