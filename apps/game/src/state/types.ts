export type FounderId = 'kirill' | 'sadman' | 'sergio'

export interface Founder {
  id: FounderId
  name: string
  role: string
  emoji: string
  color: string
  morale: number
  stress: number
}

export type SceneId = 'S1' | 'S2' | 'S3'
export type Location = 'Budapest' | 'Debrecen' | 'Investor room'

export type Screen =
  | 'opening'
  | 'play'      // S1/S2/S3 with events
  | 'result'    // hackathon result interstitial
  | 'devin'     // mission control (E04 send_devin)
  | 'ending'

/** Stable event ids from docs/SKIT.md */
export type EventId = 'E01' | 'E02' | 'E03' | 'E04' | 'E05'

export interface GameState {
  screen: Screen
  scene: SceneId
  location: Location
  day: number
  eventIndex: number            // 0..4 → E01..E05
  resolved: Partial<Record<EventId, string>>  // eventId → choiceId (each choice applies once)

  cash: number
  users: number
  health: number
  morale: number
  ownership: number             // founders' %
  dailyBurn: number
  founders: Record<FounderId, Founder>

  missionOutcome: 'none' | 'success' | 'failure' | 'skipped'
  missionMode: 'live' | 'cached' | 'mock' | null
  missionEvidence: { tests: string; before: number; after: number } | null
  runId: string
}

export interface Effects {
  cash?: number
  users?: number
  health?: number
  morale?: number
  ownership?: number            // absolute set, not delta
  dailyBurn?: number            // absolute set
}

export interface Choice {
  id: string
  label: string
  hint?: string
  effects?: Effects
  reaction?: Line
  kind?: 'devin' | 'danger' | 'money' | 'normal'
  engineeringMission?: 'optimize_feed'
}

export interface Line { who: FounderId; text: string }

export interface GameEvent {
  id: EventId
  scene: SceneId
  icon: string
  title: string
  prompt?: string               // voice prompt, e.g. "Say what we're building."
  dialogue: Line[]
  choices: Choice[]
  voice?: boolean
  onEnter?: Effects
}
