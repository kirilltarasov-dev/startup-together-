import type { GameEvent } from '../state/types'

export const HACKATHON_EVENTS: GameEvent[] = [
  {
    id: 'h_auth',
    phase: 'hackathon',
    icon: '🔐',
    speaker: 'kirill',
    title: '"We need authentication."',
    description: 'Kirill has opened a blank file called auth.py and is staring at it with the confidence of a man who has never been hacked.',
    choices: [
      { label: 'Build it properly', hint: '-40 min · debt -5', effects: { minutes: 40, technicalDebt: -5, productHealth: 8, stress: { kirill: 10 } }, outcome: 'Two hours later it works. Kirill claims it took forty minutes.' },
      { label: 'Hardcode it', hint: '-5 min · debt +20', effects: { minutes: 5, technicalDebt: 20, productHealth: -3 }, outcome: 'Username: admin. Password: admin. Kirill calls it "zero-trust" because he trusts nobody to find it.' },
      { label: 'Skip auth entirely', hint: '-0 min · reputation -5', effects: { technicalDebt: 10, reputation: -5, morale: { valentina: -5 } }, outcome: '"Users are a privacy feature," says Rafi. Nobody laughs.', kind: 'danger' },
    ],
  },
  {
    id: 'h_pizza',
    phase: 'hackathon',
    icon: '🍕',
    speaker: 'rafi',
    title: 'The pizza has arrived.',
    description: 'Rafi has calculated that 3 founders × 5 hours = exactly one large pizza. He was wrong. Also, the pizza costs €22 and you have €37.',
    choices: [
      { label: 'Buy the pizza', hint: '-€22 · morale +', effects: { cash: -22, morale: { all: 10 }, minutes: 15 }, outcome: 'Morale restored. Bank account: €15. Worth it.', kind: 'money' },
      { label: 'Eat the free hackathon sandwiches', hint: 'stress +', effects: { stress: { all: 8 }, minutes: 5 }, outcome: 'The sandwiches were labeled "vegan" and "since Tuesday". Both were true.' },
      { label: 'Pitch the pizza guy', hint: 'chaos', effects: { minutes: 20, reputation: 3, morale: { valentina: 8 } }, outcome: 'Valentina convinced the delivery guy to sign up. He is your first user. He wants a refund on a free product.' },
    ],
  },
  {
    id: 'h_scope',
    phase: 'hackathon',
    icon: '🧠',
    speaker: 'valentina',
    title: '"What if it also had a token?"',
    description: 'Valentina has drawn a diagram on a napkin. The diagram has 14 arrows. One of them points at the word "vibes".',
    choices: [
      { label: 'Focus. One feature.', hint: 'health +10', effects: { minutes: 10, productHealth: 12, morale: { valentina: -8 } }, outcome: 'The napkin is folded away. Valentina says she "respects the decision" in a tone that says otherwise.' },
      { label: 'Add the token', hint: 'debt +25 · chaos', effects: { minutes: 45, technicalDebt: 25, reputation: 5, morale: { valentina: 15, kirill: -10 } }, outcome: 'There is now a $VIBES token. Kirill has aged visibly.', kind: 'danger' },
      { label: 'Add a leaderboard instead', hint: 'compromise', effects: { minutes: 25, technicalDebt: 8, productHealth: 4 }, outcome: 'Everybody wins. Nobody is satisfied. Classic compromise.' },
    ],
  },
  {
    id: 'h_devin_landing',
    phase: 'hackathon',
    icon: '🤖',
    speaker: 'kirill',
    title: 'Landing page: does not exist.',
    description: 'Demo is in 90 minutes. The "product" is a curl command. Kirill says the curl command *is* the landing page.',
    choices: [
      { label: 'Valentina builds it', hint: '-50 min · looks great', effects: { minutes: 50, productHealth: 6, reputation: 8, stress: { valentina: 15 } }, outcome: 'It is beautiful. Every button links to the same page. That page is also beautiful.' },
      { label: 'Kirill builds it', hint: '-30 min · looks... functional', effects: { minutes: 30, reputation: 2, morale: { valentina: -6 } }, outcome: 'Times New Roman. Default blue links. A <marquee>. Valentina has left the room.' },
      { label: 'Use a template and lie', hint: '-10 min', effects: { minutes: 10, reputation: 4, technicalDebt: 5 }, outcome: 'The template still says "Acme Corp — Built for Enterprise" in the footer. Nobody notices.' },
    ],
  },
  {
    id: 'h_demo_panic',
    phase: 'hackathon',
    icon: '⏰',
    speaker: 'system',
    title: 'Demo starts in 21 minutes.',
    description: 'The backend works. The frontend works. They do not work with each other. Also Rafi has invited a journalist.',
    choices: [
      { label: 'Polish the UI', hint: 'demo score +', effects: { minutes: 21, reputation: 6, productHealth: -4 }, outcome: 'It looks incredible. It does nothing. Judges love it.' },
      { label: 'Fix the backend', hint: 'technical score +', effects: { minutes: 21, productHealth: 10, technicalDebt: -6 }, outcome: 'It works! On Kirill\'s laptop. In one specific tab. Do not close the tab.' },
      { label: 'Add another AI feature', hint: 'chaos +', effects: { minutes: 21, technicalDebt: 15, reputation: 8, stress: { all: 10 } }, outcome: 'There are now three chatbots. They are talking to each other. One is rude.', kind: 'danger' },
      { label: 'Rehearse the pitch', hint: 'demo score ++', effects: { minutes: 21, reputation: 10, morale: { all: 5 } }, outcome: 'Valentina delivers it flawlessly. The product crashes on slide 2. She does not stop talking. Legend.' },
    ],
  },
]
