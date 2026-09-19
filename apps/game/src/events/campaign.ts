import { EVENTS } from './skit.ts'
import type { Choice, Effects, FounderId, GameEvent, GameState, Line, SceneId } from '../state/types'

export const CHAPTERS = ['01 / THE LAUNCH', '02 / RENT IS DUE', '03 / THE INTERNET ARRIVES', '04 / OTHER PEOPLE’S MONEY', '05 / THE COMPANY YOU BUILT']
const line = (who: FounderId, text: string): Line => ({ who, text })
const k = (text: string) => line('kirill', text)
const s = (text: string) => line('sadman', text)
const g = (text: string) => line('sergio', text)
const choice = (id: string, label: string, effects: Effects, reaction: Line): Choice => ({ id, label, effects, reaction,
  hint: Object.entries(effects).filter(([key]) => !['flags', 'days'].includes(key)).map(([key, value]) => `${key} ${['ownership', 'dailyBurn'].includes(key) ? '→ ' : Number(value) >= 0 ? '+' : ''}${value}`).join(' · '),
})
const beat = (n: number, chapter: number, title: string, dialogue: Line[], choices: Choice[], extra: Partial<GameEvent> = {}): GameEvent => ({
  id: `C${n}`, scene: (chapter === 1 ? 'S1' : chapter <= 3 ? 'S2' : 'S3') as SceneId,
  chapter: CHAPTERS[chapter - 1], icon: '', title, dialogue, choices,
  onEnter: chapter > 1 ? { days: 2 } : undefined, ...extra,
})
const original = (id: string, chapter: number): GameEvent => ({ ...EVENTS.find((event) => event.id === id)!, chapter: CHAPTERS[chapter - 1] })

export const CAMPAIGN_EVENTS: GameEvent[] = [
  original('E01', 1),
  beat(1, 1, 'The fourth founder', [g('Someone wants to join. He owns the domain.'), k('That is not a job description.'), s('He wants thirty percent. The domain contains a spelling error.')], [
    choice('buy', 'Buy a less terrible domain', { cash: -9, trust: 4 }, k('We own the company and a correctly spelled noun. Strong start.')),
    choice('subdomain', 'Launch on the free subdomain', { debt: 5, morale: 3 }, g('The extra dots make us look technical.')),
  ]),
  beat(2, 1, 'Who gets to say no?', [k('Before we build: what happens when one of us promises something impossible?'), g('Why are you looking at me?'), s('The sample size is small. The confidence interval is not.')], [
    choice('pact', 'Write a founder agreement', { trust: 12, morale: -3, flags: { founderPact: true } }, k('No surprise commitments. All three signatures. Especially yours.')),
    choice('vibes', 'We trust each other. Ship.', { morale: 8, debt: 4 }, g('A handshake is just a contract with better UX.')),
  ], { conversations: [{ label: 'Ask Sadman about ownership', lines: [s('Equal shares are easy. Equal expectations are difficult.'), k('So this is about what happens when we disagree.'), s('It is exclusively about that.')] }] }),
  beat(3, 1, 'One password to rule them all', [s('We need a login boundary, not a login-shaped button.'), g('Can the password be founder? Very on-brand.'), k('This is a product decision, not an actual code repair. Pick the tradeoff.')], [
    choice('safe', 'Use a boring, established login', { cash: -5, health: 8, debt: -8 }, s('Boring is what we call security that works.')),
    choice('shortcut', 'Use the temporary shared account', { users: 8, debt: 18, flags: { sharedLogin: true } }, k('Temporary. I am writing down that you said temporary.')),
  ]),
  beat(4, 1, 'Sergio’s launch trailer', [g('I made a trailer. It shows features from three competing products.'), k('Do any of those features exist here?'), g('The enthusiasm is entirely original.')], [
    choice('honest', 'Show the one thing that works', { trust: 10, users: 5 }, g('Fine. A very short trailer. Art-house.')),
    choice('hype', 'Keep the ambitious trailer', { users: 25, trust: -10, flags: { overpromised: true } }, s('We have acquired a roadmap-shaped liability.')),
  ]),
  beat(5, 1, 'A customer, not a judge', [g('A café owner wants a private group for local founders. She will pay if it saves her time.'), k('That is more specific than our entire pitch deck.'), s('Ask about her work. Not whether she likes our logo.')], [
    choice('listen', 'Interview her before pitching', { trust: 8, users: 4, flags: { customerResearch: true } }, s('Her problem is event coordination. Ours was assuming we knew her problem.')),
    choice('pitch', 'Offer lifetime access for feedback', { users: 15, flags: { lifetimeDeal: true } }, g('Lifetime is such a warm, friendly word.')),
  ], { conversations: [{ label: 'Ask what she actually needs', lines: [s('She copies the same event into five chats. Nobody knows which version is current.'), k('One shared source. No blockchain.'), g('Could the source have a launch trailer?')] }] }),
  original('E02', 1),
  original('E03', 2),
  beat(6, 2, 'The apartment is the office', [k('The landlord says three workstations do not count as a dining room.'), g('I called it our European headquarters.'), s('He has requested the rent, not the deck.')], [
    choice('pay', 'Pay the workspace contribution', { cash: -35, morale: 6, trust: 4 }, k('One fewer existential threat with a key to the building.')),
    choice('defer', 'Negotiate an extension', { trust: -4, flags: { rentDeferred: true } }, g('Our first financing round is from a landlord.')),
  ]),
  beat(7, 2, 'What does the product cost?', [g('People keep asking about pricing. I have been saying “yes”.'), k('We need a number.'), s('And a reason the number exists.')], [
    choice('subscription', 'Charge a modest subscription', { cash: 60, revenue: 4, users: -8, trust: 5, flags: { subscription: true } }, s('A few people left. A few paid. We learned something expensive for free.')),
    choice('free', 'Keep it free. Sell the growth.', { users: 100, dailyBurn: 5, flags: { growthFirst: true } }, g('Revenue is a future version of users. Probably.')),
    choice('services', 'Sell onboarding help', { cash: 100, revenue: 2, morale: -5 }, k('We are now a software company with a consulting problem.')),
  ]),
  beat(8, 2, 'The support inbox remembers', [s('A customer sent a screenshot of a feature we do not have.'), g('That might be my trailer.'), k('What do we tell her?')], [
    choice('clarify', 'Explain the roadmap honestly', { trust: 8, users: 12 }, s('She said clear expectations are a feature. We should ship those.')),
    choice('promise', 'Promise it next week', { users: 25, debt: 10, flags: { featurePromise: true } }, k('We have invented interest-bearing promises.')),
  ], { variant: { when: 'overpromised', title: 'Your trailer has become a contract', dialogue: [g('Remember the launch trailer? A customer bought based on it.'), k('We sold her something that does not exist.'), s('A refund would be cheaper than redefining existence.')], choices: [
    choice('refund', 'Refund and correct the claim', { cash: -25, trust: 8 }, g('She accepted. I am deleting several adjectives.')),
    choice('promise', 'Commit to building it', { debt: 15, morale: -8, flags: { featurePromise: true } }, k('That promise now belongs to all of us.')),
  ] } }),
  beat(9, 2, 'Someone else is in my account', [s('A researcher sent a responsible disclosure email. It is polite, which makes it worse.'), k('We should take it seriously.'), g('Can we at least thank them before panicking?')], [
    choice('audit', 'Review the access boundaries', { cash: -20, health: 8, debt: -8, trust: 8 }, s('The checks caught a permissions edge case. This is a simulated business decision, not a Devin verification.')),
    choice('delay', 'Schedule it after growth', { health: -8, debt: 10, trust: -5 }, k('I have added “after growth” to our list of imaginary dates.')),
  ], { variant: { when: 'sharedLogin', title: 'Temporary has lasted six weeks', dialogue: [s('The shared account is still active. Someone changed the profile photo for everyone.'), g('At least the new photo is professional.'), k('We fix the boundary and tell affected users. Or we compound it.')], choices: [
    choice('repair', 'Retire the shortcut and notify users', { cash: -35, health: 10, debt: -15, trust: -5, flags: { retiredSharedLogin: true } }, s('No spin. No invented test result. Acknowledgement first.')),
    choice('hide', 'Quietly change the shared password', { health: -15, trust: -18, debt: 8, flags: { hiddenIncident: true } }, k('That does not address the underlying design.')),
  ] } }),
  beat(10, 2, 'The cheapest server has feelings', [k('The hosting invoice arrived. It is larger than our lunch budget.'), g('Could we sponsor it? “This outage brought to you by—”'), s('The bill is real. The scale is mostly hypothetical.')], [
    choice('rightsize', 'Right-size the infrastructure', { cash: -25, dailyBurn: 3, debt: -5 }, s('We no longer provision for every person with a phone.')),
    choice('reserve', 'Buy capacity for the launch', { cash: -50, dailyBurn: 6, health: 8, flags: { capacity: true } }, k('This buys headroom. It does not fix inefficient code.')),
  ]),
  beat(11, 2, 'The lifetime customer', [g('Our first customer invited her whole team.'), k('That is good.'), s('She also asked whether “lifetime” includes her subsidiaries.')], [
    choice('boundaries', 'Define a fair team plan', { cash: 75, revenue: 3, trust: 5 }, g('A boundary. With an upsell. I can work with this.')),
    choice('generous', 'Keep the early promise', { users: 60, trust: 10, dailyBurn: 4 }, k('Generosity goes in the budget, not outside it.')),
  ], { variant: { when: 'lifetimeDeal', title: 'Lifetime has entered the chat', dialogue: [s('The lifetime offer has been forwarded to forty colleagues.'), g('I did not specify whose lifetime.'), k('We are not litigating mortality with a café owner.')], choices: [
    choice('honour', 'Honour the original customer’s deal', { trust: 15, cash: -25, flags: { honouredPromise: true } }, g('She wrote us a testimonial. It mentions integrity. New market.')),
    choice('revoke', 'Revoke it and charge everyone', { cash: 100, trust: -20, users: -40 }, s('Short-term cash. Long-term screenshots.')),
  ] } }),
  original('E04', 3),
  beat(12, 3, 'The morning after the incident', [g('Everyone wants an update. I drafted “everything is fine”.'), k('That sentence needs evidence.'), s('Start with what we know, and separate it from what we hope.')], [
    choice('transparent', 'Publish an honest incident report', { trust: 10, users: 25, debt: -5 }, k('We describe the actual outcome. No imaginary verification numbers.')),
    choice('spin', 'Call it a planned maintenance window', { trust: -12, users: 40, flags: { hiddenIncident: true } }, s('The maintenance window arrived through a wall.')),
  ], { variant: { when: 'mission_success', title: 'The fix is real. The trust is yours to earn.', dialogue: [k('The independent checks passed. We can point to the actual result.'), s('The process is repeatable. The relief is temporary.'), g('Can I say the engineer saved us? That one is actually true.')], choices: [
    choice('evidence', 'Show the real evidence and limitations', { trust: 18, users: 50, flags: { evidenceCulture: true } }, k('A verified repair, not a promise of permanent perfection.')),
    choice('victory', 'Declare outages solved forever', { users: 80, trust: -8, flags: { overpromised: true } }, s('Forever. We have met this word before.')),
  ] } }),
  beat(13, 3, 'The most dangerous metric', [g('We have more signups than yesterday. I have prepared a chart.'), s('Most have not returned. I have prepared a different chart.'), k('Which chart decides what we build?')], [
    choice('retention', 'Talk to the users who returned', { trust: 8, revenue: 3, health: 5, flags: { retainedUsers: true } }, s('They want reliable groups, not another feed animation.')),
    choice('signups', 'Spend on another launch', { cash: -40, users: 200, dailyBurn: 7 }, g('The chart is enormous. Please do not click its second tab.')),
  ]),
  beat(14, 3, 'A competitor launches your roadmap', [g('They copied our idea. Their screenshots are much better.'), k('They have employees.'), s('Also, the problem existed before we named it.')], [
    choice('niche', 'Serve the customers we understand', { users: 35, revenue: 4, trust: 8, flags: { niche: true } }, k('We do not need every user. We need a reason for these users to stay.')),
    choice('copy', 'Match every feature on their page', { users: 120, debt: 18, morale: -10 }, s('Our backlog now has an external product manager.')),
  ], { conversations: [{ label: 'Ask Sergio why he is worried', lines: [g('What if they look like the company we promised to become?'), k('Then we stop promising a silhouette and build something useful.'), g('I would like that on the next deck.')] }] }),
  beat(15, 3, 'The contractor’s first question', [s('A contractor opened the repository. Their first message was just a question mark.'), k('The second was a quote.'), g('For the work, or about our life choices?')], [
    choice('cleanup', 'Pay for the unglamorous cleanup', { cash: -70, debt: -20, health: 12, morale: 5 }, k('Simulated maintenance completed. We do not label it as another live agent mission.')),
    choice('document', 'Write down the dangerous parts', { debt: -8, trust: 4, morale: -3 }, s('The map is not the repair. It is still better than folklore.')),
    choice('ignore', 'Keep shipping through it', { users: 70, debt: 15, health: -8 }, g('Velocity is a feeling. The errors seem more measurable.')),
  ]),
  original('E05', 4),
  beat(16, 4, 'The first board meeting', [g('The investor asked for a monthly update. I made twelve slides.'), k('We have five meaningful numbers.'), s('That leaves seven slides for honesty.')], [
    choice('honest', 'Report retention, costs and risks', { trust: 10, debt: -3 }, k('They asked useful questions. Apparently that is allowed.')),
    choice('vanity', 'Lead with total registrations', { trust: -8, morale: 4, flags: { vanityBoard: true } }, s('The second meeting will require a larger font.')),
  ], { conversations: [{ label: 'Discuss taking the bridge', lines: [k('Twenty percent bought breathing room, not permission to stop thinking.'), s('If we declined, the next bill still exists.'), g('Either way, we should stop buying presentation templates.')] }] }),
  beat(17, 4, 'Your first hire has another offer', [g('A developer likes the product. They do not like our salary.'), k('We can offer a small paid trial. Not exposure.'), s('Exposure is also what happens when you remove a roof.')], [
    choice('trial', 'Fund a properly scoped trial', { cash: -100, dailyBurn: 9, health: 12, debt: -10, flags: { hired: true } }, k('They fixed the onboarding flow and asked where we keep the documentation.')),
    choice('wait', 'Stay three founders for now', { morale: -6, debt: 4 }, g('I told them we were “selectively hiring”. We selected rent.')),
  ]),
  beat(18, 4, 'Enterprise wants a special button', [g('An enterprise customer will pay €300 for a custom approval workflow.'), k('That is almost a different product.'), s('Almost is doing a lot of work in that sentence.')], [
    choice('custom', 'Take the contract with a hard scope', { cash: 300, revenue: 5, debt: 12, morale: -6, flags: { enterprise: true } }, g('Signed. I did not add “unlimited” anywhere. Personal growth.')),
    choice('product', 'Build only the reusable part', { cash: 100, revenue: 3, health: 6, trust: 5 }, k('Less cash today. One product tomorrow.')),
  ]),
  beat(19, 4, 'The promise ledger', [k('We should review every promise with a due date.'), g('Could we start with the ones that went well?'), s('That would be a very short meeting.')], [
    choice('scope', 'Cut two low-value promises', { trust: -3, debt: -12, morale: 8 }, k('We contacted the customers first. Disappointment beats a surprise.')),
    choice('deliver', 'Finish the promised feature', { cash: -40, health: 7, trust: 10 }, g('The customer noticed. We should do this more often.')),
  ], { variant: { when: 'featurePromise', title: 'Next week was three weeks ago', dialogue: [g('The customer forwarded my promise. With the date highlighted.'), k('She has become our project management software.'), s('Respond before she becomes our marketing software.')], choices: [
    choice('deliver', 'Deliver the commitment, nothing extra', { cash: -60, health: 8, debt: -8, trust: 12 }, k('The promise is closed. Nobody announce another one.')),
    choice('refund', 'Refund and renegotiate the scope', { cash: -35, trust: -5, debt: -10, flags: { refundedPromise: true } }, s('A smaller honest product is still a product.')),
  ] } }),
  beat(20, 4, 'Kirill closes the laptop', [k('I cannot be every escalation path and still be a person.'), g('I thought you liked fixing things.'), s('Liking water does not make drowning a hobby.')], [
    choice('rotation', 'Share on-call and protect a day off', { health: -4, morale: 18, trust: 8, flags: { sustainable: true } }, k('I am taking Sunday. If it is not actually on fire, write a ticket.')),
    choice('push', 'Push through until the next milestone', { health: 5, morale: -20, flags: { burnout: true } }, s('The milestone has moved four times. His sleep has not.')),
  ], { variant: { when: 'founderPact', title: 'The agreement gets its first real test', dialogue: [k('We agreed nobody would carry the company alone. I need us to mean it.'), g('Then I am taking support. Even the angry emails.'), s('I will take the next incident review. We wrote this down for a reason.')], choices: [
    choice('honour', 'Enforce the agreement we signed', { morale: 22, trust: 12, flags: { sustainable: true } }, g('The handshake was good. The written part was better.')),
    choice('exception', 'Make one more exception', { health: 6, morale: -15, trust: -8, flags: { burnout: true } }, k('An agreement that only works on easy days is decoration.')),
  ] } }),
  beat(21, 4, 'The person who never complains', [g('Sadman has not said anything all morning.'), k('That is not unusual.'), s('I rebuilt my research prototype three times to match sales promises. I would like one afternoon without a new adjective.')], [
    choice('protect', 'Protect a research afternoon', { morale: 12, debt: -8, health: 5 }, s('I found a simpler design. It fits on one page. I nearly cried.')),
    choice('roadmap', 'Ask for one more quick feature', { users: 60, morale: -12, debt: 8 }, g('I will stop calling things quick. After this one.')),
  ]),
  beat(22, 4, 'The privacy email', [s('A partner wants customer activity data for an “industry report”.'), g('They offered €250.'), k('Did the customers agree to this?')], [
    choice('decline', 'Decline the identifiable data deal', { trust: 15, morale: 4, flags: { privacy: true } }, k('Their data is not our emergency fund.')),
    choice('aggregate', 'Offer only consented aggregate research', { cash: 80, trust: 6, health: 3 }, s('Documented consent, minimum groups, no identifiable rows. Less impressive to the partner. Better.')),
  ]),
  beat(23, 5, 'The board discovers burn', [g('The investor asked why our costs grew faster than our users.'), k('Because the expensive things are actual invoices.'), s('We need an answer that survives arithmetic.')], [
    choice('margin', 'Prioritize paying, retained customers', { cash: 160, revenue: 6, users: -40, dailyBurn: 5, flags: { margins: true } }, s('The graph is smaller. The bank account is larger.')),
    choice('growth', 'Keep buying growth', { cash: -90, users: 400, dailyBurn: 12, trust: -5 }, g('I have made a very tall graph. Please fund the graph.')),
  ], { conversations: [{ label: 'Ask about the next round', lines: [s('Investment is not revenue. It changes who can ask us difficult questions.'), k('A new round should buy a defined improvement, not defer the same decision.'), g('Can we say that politely to the vest?')] }] }),
  beat(24, 5, 'Someone offers to buy you', [g('A bigger company wants the product, the team and our customer relationships.'), k('What happens to the users after the deal?'), s('The letter says “strategic integration”. That is not an answer.')], [
    choice('diligence', 'Open talks with user protections', { trust: 6, flags: { acquisitionTalks: true } }, k('No agreement without continuity commitments and a real price.')),
    choice('independent', 'Commit to independence', { morale: 10, trust: 5, flags: { independent: true } }, g('I am keeping their email. For emotional support.')),
  ]),
  beat(25, 5, 'Due diligence opens the cupboard', [s('Someone has requested our incident history and customer commitments.'), k('Good. We should be able to explain both.'), g('I have renamed the folder from “oops” to “operations”.')], [
    choice('disclose', 'Provide the actual record', { trust: 10, cash: -20 }, k('No invented uptime, no missing reports, no creative revenue.')),
    choice('delay', 'Delay until the records are cleaner', { cash: -40, trust: -6, morale: -5 }, s('They asked whether we were hiding something. We are now hiding our embarrassment.')),
  ], { variant: { when: 'hiddenIncident', title: 'A screenshot survives the cleanup', dialogue: [s('The buyer found the maintenance announcement next to the outage reports.'), g('Those two documents tell different stories.'), k('We correct the record now. This is the cost of the earlier decision.')], choices: [
    choice('correct', 'Correct the record and accept the cost', { cash: -70, trust: -12, flags: { correctedRecord: true } }, k('We can recover trust. We cannot edit other people’s screenshots.')),
    choice('withdraw', 'Withdraw from acquisition talks', { morale: -8, flags: { acquisitionTalks: false, independent: true } }, s('We still owe customers the truth. A cancelled deal does not erase that.')),
  ] } }),
  beat(26, 5, 'Technical debt collects', [s('Every change touches six things. Three of them have misleading names.'), k('This is the accumulated cost of our earlier shortcuts.'), g('Can we refinance technical debt?')], [
    choice('repay', 'Stop feature work for maintenance', { cash: -65, debt: -25, health: 15, morale: 5 }, k('A simulated maintenance sprint. The real Devin evidence remains the earlier mission only.')),
    choice('contain', 'Isolate the worst subsystem', { cash: -25, debt: -12, health: 6 }, s('A smaller blast radius is an improvement. Not absolution.')),
    choice('defer', 'Let next quarter handle it', { users: 80, debt: 18, health: -15 }, g('Next quarter has declined our calendar invitation.')),
  ]),
  beat(27, 5, 'The customer council', [g('The café owner organized a call with five customers.'), k('What do they want?'), s('Reliability, clear pricing and not being treated as a slide.')], [
    choice('listen', 'Give them a real seat at the roadmap', { trust: 15, revenue: 5, health: 4 }, g('They did not ask for any of the things in my viral thread.')),
    choice('announce', 'Present the roadmap we already wrote', { users: 50, trust: -8 }, k('We held a listening session and forgot the listening.')),
  ], { variant: { when: 'customerResearch', title: 'The café owner remembers Budapest', dialogue: [g('She still uses the product. She brought four other businesses.'), s('She says we listened before we had a product. She wants us to keep doing that.'), k('That is a better moat than our domain name.')], choices: [
    choice('council', 'Build a customer advisory circle', { cash: 100, revenue: 8, trust: 18, flags: { community: true } }, s('A compounding relationship. No growth hack required.')),
    choice('testimonial', 'Use the testimonial and keep moving', { users: 120, cash: 50 }, g('A good story. We should remember the person inside it.')),
  ] } }),
  beat(28, 5, 'Nobody checks Slack at the lake', [g('We have earned one afternoon away from the apartment.'), k('Who is covering support?'), s('We can arrange coverage, or pretend relaxation is a deployment strategy.')], [
    choice('coverage', 'Arrange coverage, then take the afternoon', { cash: -30, morale: 16, trust: 5, flags: { sustainable: true } }, k('For the first time in months, nothing urgent happened. I almost checked anyway.')),
    choice('stay', 'Stay and finish the release', { health: 6, morale: -10 }, g('We went to the lake emotionally. It was beautiful.')),
  ], { conversations: [{ label: 'Check in with the team', lines: [k('I want us to be proud of this without needing it to prove our worth.'), s('I would settle for sleeping without a phone under my pillow.'), g('I still want a big company. I want you two there when it gets big.')] }] }),
  beat(29, 5, 'The last bridge', [g('We can sell one final annual contract or ask for another small investment.'), k('The contract requires work. The investment requires ownership.'), s('Neither is free money. Pick the obligation we actually want.')], [
    choice('contract', 'Earn the next runway', { cash: 250, revenue: 6, debt: 8, morale: -4, flags: { earnedRunway: true } }, k('We owe customers a service. That was always the point.')),
    choice('bridge', 'Sell another slice for breathing room', { cash: 400, ownership: 65, trust: -5, flags: { secondBridge: true } }, g('Sixty-five percent of something. Please let it be something.')),
    choice('small', 'Cut costs and stay small', { dailyBurn: 2, users: -80, morale: 7, flags: { smallBusiness: true } }, s('Smaller is not the opposite of successful.')),
  ]),
  beat(30, 5, 'What did we actually build?', [g('The buyer wants an answer. So do the customers. So do I.'), k('We started with thirty-seven euros and a claim that this would be easy.'), s('Thirty-seven is still prime. The rest of the evidence has changed.')], [
    choice('sell', 'Accept an exit, subject to diligence', { flags: { sell: true } }, k('The result depends on the company we actually built—not the pitch.')),
    choice('indie', 'Keep the company independent', { morale: 5, flags: { independent: true, sell: false } }, s('Then tomorrow we serve customers. An unusually concrete plan.')),
    choice('scale', 'Keep building toward a bigger company', { flags: { scale: true, sell: false } }, g('This time, we will announce the features after they exist. Mostly.')),
  ], { conversations: [
    { label: 'Ask Kirill what success means', lines: [k('A product people rely on. A team that can disagree safely. Evidence when we claim something works.'), s('You have become alarmingly reasonable.'), k('Do not put that on the landing page.')] },
    { label: 'Ask Sergio what he learned', lines: [g('Hype gets someone through the door. Then the product has to keep the promise.'), k('And the company has to keep its people.'), g('Fine. That is the final slide.')] },
  ] }),
]

export function campaignEventAt(index: number, state: Pick<GameState, 'flags' | 'missionOutcome'>): GameEvent | undefined {
  const event = CAMPAIGN_EVENTS[index]
  if (!event?.variant) return event
  const matches = event.variant.when === 'mission_success' ? state.missionOutcome === 'success' : state.flags[event.variant.when]
  return matches ? { ...event, ...event.variant } : event
}

export function campaignEnding(state: Pick<GameState, 'cash' | 'health' | 'morale' | 'trust' | 'debt' | 'revenue' | 'dailyBurn' | 'flags'>) {
  if (state.cash <= 0) return 'OUT OF RUNWAY'
  if (state.morale < 25) return 'THE COMPANY OUTLASTED THE TEAM'
  if (state.health < 35 || state.debt > 85) return 'TECHNICAL DEBT CAME DUE'
  if (state.flags.sell && state.trust >= 55 && state.health >= 50) return 'ACQUIRED, WITHOUT SELLING OUT'
  if (state.flags.sell) return 'THE DEAL FELL THROUGH'
  if (state.trust >= 60 && state.revenue >= state.dailyBurn && state.health >= 50) return state.flags.scale ? 'READY FOR THE NEXT CHAPTER' : 'A BUSINESS WORTH KEEPING'
  return 'STILL BUILDING, STILL TOGETHER'
}
