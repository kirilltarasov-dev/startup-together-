// Conservative text -> choice helpers. Partial-transcript and secondary-recognizer
// dispatch paths are disabled; keep this public helper safe for explicit command callers.

export const CHOICE_SYNONYMS: Record<string, string[]> = {
  focused: ['founders only', 'founder only', 'focus on founders', 'keep it focused', 'stay focused'],
  broad: ['everyone with a pitch', 'everyone', 'everybody', 'go broad', 'make it broad', 'open it up'],
  careful: ['test the launch', 'test first', 'test it first', 'run tests', 'be careful', 'verify it', 'check it', 'slow down'],
  rush: ['ship tonight', 'ship it', 'launch now', 'rush it', 'send it', 'go live'],
  celebrate: ['buy the team dinner', 'team dinner', 'celebrate', 'throw a party'],
  save: ['save every forint', 'save the money', 'save money', 'keep the money', 'be frugal'],
  // A paid mission requires a direct selection or an explicit instruction to Devin. A bare name is not a command.
  send_devin: ['send devin', 'call devin', 'tell devin to fix the feed', 'ask devin to fix the feed', 'have devin fix the feed', 'send devin to fix the feed'],
  disable_feed: ['disable the feed', 'turn off the feed', 'kill the feed', 'shut down the feed', 'switch off the feed', 'take the feed down'],
  accept: ['accept', 'accept the offer', 'take the bridge', 'take the offer'],
  decline: ['decline', 'decline the offer', 'no deal', 'stay independent', 'walk away', 'reject the offer', 'pass on the offer'],
  continue: ['continue', 'next', 'go on', 'move on', 'keep going', 'lets go', 'let s go', 'carry on', 'proceed', 'okay go', 'onwards', 'next scene'],
}

/** Skip / advance words the local ear acts on in any floor state. */
export const CONTINUE_WORDS = ['continue', 'next', 'skip', 'go on', 'move on', 'keep going', 'lets go', 'let s go', 'carry on', 'proceed']

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const QUESTION_START = /^(what|when|where|why|who|which|how|can|could|would|will|should|do|does|did|is|are|am|have|has)\b/
const NEGATION = /\b(do not|don t|dont|not|never|avoid|without|stop|cancel|rather not)\b/
const AMBIGUOUS = /\b(maybe|perhaps|might|if|unless|either|or|versus|vs|between|consider|discuss|mention|heard|explain)\b/
const COMMAND_PREFIXES = [
  'i think we should',
  'we should',
  'we need to',
  'i want to',
  'i would like to',
  'we will',
  'we are going to',
  'let us',
  'go with',
  'please',
  'okay',
  'ok',
  'yeah',
  'yes',
  'lets',
  'let s',
  'i think',
  'i choose',
  'choose',
  'pick',
  'just',
]
const COMMAND_SUFFIXES = ['for now', 'please', 'instead', 'then', 'first', 'now', 'tonight', 'today']

function stripCommandFraming(text: string): string {
  let result = text
  let changed = true
  while (changed) {
    changed = false
    for (const prefix of COMMAND_PREFIXES) {
      if (result.startsWith(`${prefix} `)) {
        result = result.slice(prefix.length + 1)
        changed = true
        break
      }
    }
  }
  return result
}

function isRejectedUtterance(text: string, normalized: string): boolean {
  return text.includes('?') || QUESTION_START.test(normalized) || NEGATION.test(normalized) || AMBIGUOUS.test(normalized)
}

function isExplicitCommand(text: string, phrases: string[]): boolean {
  const normalized = normalizeText(text)
  if (!normalized || isRejectedUtterance(text, normalized)) return false
  const command = stripCommandFraming(normalized)
  const normalizedPhrases = phrases.map(normalizeText)
  if (normalizedPhrases.includes(command)) return true
  return COMMAND_SUFFIXES.some((suffix) =>
    command.endsWith(` ${suffix}`) && normalizedPhrases.includes(command.slice(0, -suffix.length - 1)),
  )
}

/** Unique whole-utterance, affirmative choice command among `choices`, or null. */
export function matchChoice(text: string, choices: { id: string; label: string }[]): string | null {
  const hits = new Set<string>()
  for (const c of choices) {
    const keys = [normalizeText(c.label), c.id.replace(/_/g, ' '), ...(CHOICE_SYNONYMS[c.id] ?? [])]
    if (isExplicitCommand(text, keys)) hits.add(c.id)
  }
  return hits.size === 1 ? [...hits][0] : null
}

export function isContinueCommand(text: string): boolean {
  return isExplicitCommand(text, CONTINUE_WORDS)
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
