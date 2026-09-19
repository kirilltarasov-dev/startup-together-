export type FounderId = 'kirill' | 'rafi' | 'valentina'

export interface Founder {
  id: FounderId
  name: string
  role: string
  emoji: string
  morale: number
  stress: number
}

export type Stage = 'Hackathon' | 'Startup' | 'Funded' | 'Ended'
export type Location = 'Budapest' | 'Debrecen' | 'Balaton'

export type Scene =
  | 'opening'
  | 'idea'
  | 'hackathon'
  | 'judging'
  | 'transition'
  | 'startup'
  | 'devin'
  | 'ending'
  | 'postcredit'

export interface Idea {
  id: string
  company: string
  tagline: string
  market: string
  competition: string
  difficulty: string
}

export interface GameState {
  scene: Scene
  day: number
  hackathonMinutesLeft: number
  location: Location
  stage: Stage
  idea: Idea | null

  cash: number
  revenue: number // per day
  dailyBurn: number
  users: number
  productHealth: number
  technicalDebt: number
  reputation: number
  valuation: number
  equity: { founders: number; investors: number }
  founders: Record<FounderId, Founder>

  devinMissions: number
  incidentsSurvived: number
  shippedBroken: boolean
  ending: string | null
  log: string[]
}

/** Partial numeric deltas applied to state. */
export interface Effects {
  cash?: number
  revenue?: number
  dailyBurn?: number
  users?: number
  productHealth?: number
  technicalDebt?: number
  reputation?: number
  valuation?: number
  investorEquity?: number
  minutes?: number
  days?: number
  morale?: Partial<Record<FounderId | 'all', number>>
  stress?: Partial<Record<FounderId | 'all', number>>
}

export interface Choice {
  label: string
  hint?: string
  effects?: Effects
  engineeringMission?: string
  outcome?: string
  next?: string // force next event id
  kind?: 'devin' | 'danger' | 'money' | 'normal'
}

export interface GameEvent {
  id: string
  phase: 'hackathon' | 'startup'
  icon: string
  title: string
  description: string
  speaker?: FounderId | 'system' | 'judge' | 'investor'
  choices: Choice[]
  once?: boolean
}
