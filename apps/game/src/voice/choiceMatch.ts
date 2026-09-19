// Shared text -> choice matching for BOTH ears (Azure input transcript fallback in liveClient.ts and
// the local always-on SpeechRecognition command layer in commandEar.ts). Pure functions, no DOM.

export const CHOICE_SYNONYMS: Record<string, string[]> = {
  focused: ['founders only', 'founder only', 'founders', 'focused', 'small', 'niche'],
  broad: ['everyone', 'everybody', 'anyone', 'broad', 'pitch', 'wide', 'open it up'],
  careful: ['test', 'tests', 'careful', 'check', 'qa', 'verify', 'slow down'],
  rush: ['ship', 'tonight', 'rush', 'launch now', 'yolo', 'send it', 'go live'],
  celebrate: ['dinner', 'celebrate', 'party', 'treat', 'buy the team'],
  save: ['save', 'forint', 'frugal', 'keep the money', 'noodles', 'cheap'],
  send_devin: ['devin', 'send devin', 'fix it', 'fix the feed', 'engineer', 'call devin'],
  disable_feed: ['disable', 'turn off', 'kill the feed', 'shut it', 'switch off', 'take it down'],
  accept: ['accept', 'take the', 'take it', 'deal', 'yes to the', 'sign', 'bridge'],
  decline: ['decline', 'no deal', 'independent', 'walk away', 'pass', 'reject', 'refuse'],
  continue: ['continue', 'next', 'go on', 'move on', 'keep going', 'lets go', 'let s go', 'carry on', 'proceed', 'okay go', 'onwards', 'next scene'],
}

/** Skip / advance words the local ear acts on in any floor state. */
export const CONTINUE_WORDS = ['continue', 'next', 'skip', 'go on', 'move on', 'keep going', 'lets go', 'let s go', 'carry on', 'proceed']

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const padded = (text: string) => ` ${normalizeText(text)} `

/** Whole-word (or, for keys > 5 chars, substring) hit of any key in `text`. */
function hasKey(t: string, keys: string[]): boolean {
  return keys.some((k) => k && (t.includes(` ${k} `) || (k.length > 5 && t.includes(k))))
}

/** Unique matching choice id among `choices`, or null if none / ambiguous. */
export function matchChoice(text: string, choices: { id: string; label: string }[]): string | null {
  const t = padded(text)
  const hits = new Set<string>()
  for (const c of choices) {
    const keys = [normalizeText(c.label), c.id.replace(/_/g, ' '), ...(CHOICE_SYNONYMS[c.id] ?? [])]
    if (hasKey(t, keys)) hits.add(c.id)
  }
  return hits.size === 1 ? [...hits][0] : null
}

export function isContinueCommand(text: string): boolean {
  return hasKey(padded(text), CONTINUE_WORDS)
}

/**
 * Echo filter helper: fraction (0..1) of `heard` tokens that also occur in `reference`.
 * 0 when either side is empty.
 */
export function tokenOverlap(heard: string, reference: string): number {
  const h = normalizeText(heard).split(' ').filter(Boolean)
  if (!h.length) return 0
  const ref = new Set(normalizeText(reference).split(' ').filter(Boolean))
  if (!ref.size) return 0
  let hit = 0
  for (const tok of h) if (ref.has(tok)) hit++
  return hit / h.length
}
