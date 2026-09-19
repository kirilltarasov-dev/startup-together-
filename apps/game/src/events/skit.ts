/** The five frozen events from docs/SKIT.md. IDs, effects and lines are user-approved — do not re-litigate. */
import type { GameEvent, Line } from '../state/types'

export const OPENING_LINES: Line[] = [
  { who: 'kirill', text: 'We have thirty-seven euros and an AI engineer.' },
  { who: 'sadman', text: "Thirty-seven is prime. That's the only good news." },
  { who: 'sergio', text: "Bro. Prime number. That's the brand." },
]

export const RESULT_LINE: Line = { who: 'sadman', text: "Statistically, that's one of us." }

export const WAITING_LINES: Line[] = [
  { who: 'kirill', text: "It's reading the code. That's more than our last contractor did." },
  { who: 'sergio', text: 'Can we ship the loading spinner as a feature? Premium tier?' },
  { who: 'sadman', text: "It's an N plus one. I could have said something. I did not." },
]

export const MISSION_LINES = {
  success: [
    { who: 'kirill', text: 'It passed the independent checks. I checked the checks.' },
    { who: 'sergio', text: "AI-ASSISTED UPTIME. That's the new tagline." },
  ],
  failure: [
    { who: 'kirill', text: 'It failed the independent checks.' },
    { who: 'sadman', text: 'Still better than finding out from the customers.' },
  ],
  timeout: { who: 'kirill', text: "Either it's thinking or it's Friday." },
} satisfies Record<string, Line | Line[]>

export const ENDING_LINES = {
  win: { who: 'kirill', text: 'We have runway. Please stop adding features.' },
  lose: { who: 'sadman', text: 'At least the demo had an ending.' },
} satisfies Record<string, Line>

export const EVENTS: GameEvent[] = [
  {
    id: 'E01',
    scene: 'S1',
    icon: '💡',
    title: 'What are we building?',
    prompt: "Say what we're building.",
    voice: true,
    dialogue: [
      { who: 'sergio', text: 'A social network for founders. Every post is a launch. We announce it tonight.' },
      { who: 'kirill', text: 'We have not written a single line.' },
      { who: 'sadman', text: "Technically the feed is O(n squared). I haven't told him." },
    ],
    choices: [
      { id: 'focused', label: 'Founders only', hint: 'health +5 · morale −5', effects: { health: 5, morale: -5 }, reaction: { who: 'sergio', text: 'Small market. Huge egos. I can sell egos.' } },
      { id: 'broad', label: 'Everyone with a pitch', hint: 'users +10 · health −5', effects: { users: 10, health: -5 }, reaction: { who: 'sadman', text: 'Everyone. So the dataset will be noisy.' } },
    ],
  },
  {
    id: 'E02',
    scene: 'S1',
    icon: '🚀',
    title: 'Ship it',
    voice: true,
    dialogue: [
      { who: 'sergio', text: "I already tweeted the launch. It's live in four hours." },
      { who: 'kirill', text: 'The demo works on my laptop. That is not the same as working.' },
      { who: 'sergio', text: 'Then we ship your laptop.' },
    ],
    choices: [
      { id: 'careful', label: 'Test the launch', hint: 'cash −12 · health +15', effects: { cash: -12, health: 15 }, reaction: { who: 'kirill', text: 'Twelve euros for tests. Finally, a budget line I respect.' } },
      { id: 'rush', label: 'Ship tonight', hint: 'cash −3 · users +20 · health −10', effects: { cash: -3, users: 20, health: -10 }, kind: 'danger', reaction: { who: 'sergio', text: 'SHIPPED. Bugs are just features with confidence.' } },
    ],
  },
  {
    id: 'E03',
    scene: 'S2',
    icon: '💸',
    title: 'Someone paid',
    voice: true,
    dialogue: [
      { who: 'sergio', text: 'SOMEONE PAID US. I told you. I told everyone.' },
      { who: 'kirill', text: "Are we sure it wasn't you?" },
      { who: 'sadman', text: "I checked the logs. It wasn't him. He can't find the payment page." },
    ],
    choices: [
      { id: 'celebrate', label: 'Buy the team dinner', hint: 'cash +90 · users +80 · morale +10 · burn 3', effects: { cash: 90, users: 80, morale: 10, dailyBurn: 3 }, kind: 'money', reaction: { who: 'sergio', text: 'Best board meeting of my life.' } },
      { id: 'save', label: 'Save every forint', hint: 'cash +120 · users +80 · morale −5 · burn 3', effects: { cash: 120, users: 80, morale: -5, dailyBurn: 3 }, reaction: { who: 'sadman', text: 'Noodles again. Optimal calories per forint.' } },
    ],
  },
  {
    id: 'E04',
    scene: 'S2',
    icon: '🚨',
    title: 'We went viral',
    prompt: 'Tell Devin what to do.',
    voice: true,
    onEnter: { users: 800, health: -25 },
    dialogue: [
      { who: 'sergio', text: 'GOOD NEWS. WE WENT VIRAL. I may have posted it in forty group chats.' },
      { who: 'kirill', text: 'Why is that the good news?' },
      { who: 'sadman', text: 'Because the bad news has a loading spinner.' },
    ],
    choices: [
      { id: 'send_devin', label: 'Send Devin', hint: 'real engineering mission · independently verified', kind: 'devin', engineeringMission: 'optimize_feed' },
      { id: 'disable_feed', label: 'Disable the feed', hint: 'health +10 · users −300', effects: { health: 10, users: -300 }, kind: 'danger', reaction: { who: 'sergio', text: 'We fixed it by deleting it. Pivot!' } },
    ],
  },
  {
    id: 'E05',
    scene: 'S3',
    icon: '🤝',
    title: 'The offer',
    prompt: 'Negotiate.',
    voice: true,
    dialogue: [
      { who: 'sergio', text: "I found an investor. In the elevator. He's basically my best friend now." },
      { who: 'kirill', text: 'Does he know what we built?' },
      { who: 'sergio', text: "Bro, let's not turn this into a technical interview." },
    ],
    choices: [
      { id: 'accept', label: 'Take the bridge', hint: '€500 for 20% · morale −5', effects: { cash: 500, ownership: 80, morale: -5 }, kind: 'money', reaction: { who: 'sergio', text: "FIVE HUNDRED EUROS. We're rich for a week." } },
      { id: 'decline', label: 'Stay independent', hint: 'ownership 100% · morale +5', effects: { morale: 5, ownership: 100 }, reaction: { who: 'kirill', text: "We'll die correct." } },
    ],
  },
]

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<GameEvent['id'], GameEvent>

/** Disable-feed reaction has a second line in the skit. */
export const DISABLE_FEED_SECOND: Line = { who: 'sadman', text: 'Like our runway.' }

export const INVESTOR_OFFER = 'EUR 500 bridge for 20% ownership.'
