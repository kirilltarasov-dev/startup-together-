import manifest from '../../.devin/scripted-voices/manifest.json' with { type: 'json' }

export interface RecordedClip { who: string; text: string; voice: string; path: string }
const clips: RecordedClip[] = manifest.clips
type Outcome = 'finished' | 'cancelled' | 'unavailable'
const pending = new Set<() => void>()

export function recordedClip(who: string, text: string): RecordedClip | undefined {
  return clips.find(clip => clip.who === who && clip.text === text)
}

/** Uses the existing stage queue; no network synthesis or microphone. */
export function playRecording(clip: RecordedClip): Promise<Outcome> {
  if (typeof Audio === 'undefined' || !/^\/assets\/voices\/[a-z0-9-]+\.wav$/.test(clip.path)) return Promise.resolve('unavailable')
  return new Promise(resolve => {
    let audio: HTMLAudioElement
    try { audio = new Audio(clip.path) } catch { resolve('unavailable'); return }
    let settled = false
    let started = false
    const finish = (result: Outcome) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      pending.delete(cancel)
      audio.onended = audio.onerror = audio.onplaying = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      resolve(result)
    }
    const cancel = () => finish('cancelled')
    // Bound unavailable/stalled assets so Continue never hangs behind a dead player.
    let timeout = setTimeout(() => finish('unavailable'), 10000)
    pending.add(cancel)
    audio.onplaying = () => {
      if (started) return
      started = true
      clearTimeout(timeout)
      timeout = setTimeout(() => finish('finished'), 60000)
    }
    audio.onended = () => finish('finished')
    // Do not repeat a half-spoken line in a different fallback voice.
    audio.onerror = () => finish(started ? 'finished' : 'unavailable')
    audio.preload = 'auto'
    audio.volume = 1
    try { void audio.play().catch(() => finish(started ? 'finished' : 'unavailable')) } catch { finish('unavailable') }
  })
}

export function cancelRecordings(): void {
  for (const cancel of [...pending]) cancel()
}

export function recordedVoiceReport(): Record<string, string> {
  const report: Record<string, string> = {}
  for (const clip of clips) report[clip.who] = `${clip.voice} [recorded English; browser fallback for uncovered lines]`
  return report
}
