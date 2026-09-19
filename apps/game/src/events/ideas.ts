import type { Idea } from '../state/types'

export const IDEAS: Idea[] = [
  {
    id: 'dating',
    company: 'Rizzly',
    tagline: 'An AI dating coach that texts for you. What could go wrong.',
    market: 'Huge',
    competition: 'Terrifying',
    difficulty: 'Medium',
  },
  {
    id: 'debug',
    company: 'Stacktrace.wtf',
    tagline: 'AI debugging platform. Ironically, it has bugs.',
    market: 'Large',
    competition: 'High',
    difficulty: 'Hard',
  },
  {
    id: 'insane',
    company: 'Definitely Not A Ponzi Scheme',
    tagline: 'A social feed where every post is an invoice.',
    market: 'Unclear',
    competition: 'Legally, none',
    difficulty: '???',
  },
]

export const INSANE_POOL: Idea[] = [
  { id: 'i1', company: 'Uber for Goulash', tagline: 'On-demand goulash. Minimum order: 4 liters.', market: 'Hungary', competition: 'Grandmothers', difficulty: 'Hard' },
  { id: 'i2', company: 'LinkedOut', tagline: 'A social network where you can only post resignations.', market: 'Everyone, eventually', competition: 'Therapy', difficulty: 'Medium' },
  { id: 'i3', company: 'Blockchain Laundry', tagline: 'Your laundry, on chain. Nobody asked.', market: 'Debrecen', competition: 'Washing machines', difficulty: '???' },
  { id: 'i4', company: 'PitchDeckGPT', tagline: 'Generates the pitch deck before the idea.', market: 'Every hackathon', competition: 'This hackathon', difficulty: 'Easy' },
]
