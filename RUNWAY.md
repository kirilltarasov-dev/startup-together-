# RUNWAY
## A startup survival game powered by Devin

You are the founding engineer, game designer, and product designer responsible for shipping a polished hackathon prototype in approximately 5 HOURS.

We are building this at a Cognition / Devin hackathon in Budapest.

The product must be:
- immediately playable
- funny
- visually memorable
- technically impressive
- understandable within 30 seconds
- demonstrably powered by Devin
- polished enough for a live stage demo

DO NOT overengineer.

The objective is not to create a complete startup simulator.

The objective is to create an unforgettable 5–8 minute playable vertical slice that makes people say:

"Holy shit, Devin is actually part of the game."

==================================================
0. ONE-SENTENCE PITCH
==================================================

RUNWAY is a startup survival game where you and your cofounders try to turn a hackathon project into a billion-dollar company before you run out of money, users, infrastructure, or sanity.

But unlike a scripted simulator:

DEVIN IS YOUR ACTUAL AI ENGINEER.

When engineering crises happen inside the game, Devin receives real tasks against a real repository.

Whether Devin succeeds or fails changes the game.

==================================================
1. CORE FANTASY
==================================================

The player starts here:

BUDAPEST
COGNITION / DEVIN HACKATHON

Cash: €37
Users: 0
Revenue: €0
Runway: basically nonexistent

Three ambitious idiots have one day to build something.

The journey can eventually become:

Hackathon
    ↓
First users
    ↓
Broken production
    ↓
Debrecen apartment startup
    ↓
Accelerator
    ↓
Seed round
    ↓
Hiring
    ↓
Scaling
    ↓
Cofounder drama
    ↓
VC pressure
    ↓
Acquisition / bankruptcy / unicorn

The game should feel like:

The Sims
+
Game Dev Tycoon
+
Reigns
+
Silicon Valley
+
AI coding agents

But compressed into a hilarious startup speedrun.

==================================================
2. MOST IMPORTANT DESIGN PRINCIPLE
==================================================

DO NOT make Devin decorative.

Bad:

Player chooses:
"Fix database"

UI waits 5 seconds.

Fake animation.

Database becomes fixed.

That is NOT interesting.

Instead:

GAME EVENT

"PRODUCTION IS DOWN"

↓

Game generates engineering task

↓

REAL DEVIN SESSION

↓

Devin receives repository + task

↓

Devin actually modifies repository

↓

Tests / verification actually execute

↓

RUNWAY interprets outcome

↓

GAME STATE CHANGES

Therefore:

REAL SOFTWARE ENGINEERING
BECOMES A GAME MECHANIC.

==================================================
3. THE META JOKE
==================================================

The game itself should contain a small real software repository representing the player's fictional startup.

Call it:

/startup-repo

Initially it should be intentionally mediocre.

Example:

FastAPI backend
SQLite
simple tests
deliberate bugs
deliberate scaling problems
deliberate security problems

During gameplay, crises correspond to REAL problems in this repository.

Example:

GAME:

"🚨 847 users just arrived from TikTok.

Your API is dying."

Actual repository problem:

An endpoint performs an intentionally expensive operation or N+1 query.

The player chooses:

"Send Devin."

RUNWAY creates a task:

"Our API endpoint /feed has become extremely slow under load.
Investigate the bottleneck, implement a fix without changing external behavior, and ensure tests pass."

REAL Devin works.

Then RUNWAY executes:

pytest
benchmark/load test

BEFORE:
1.82 sec/request

AFTER:
0.19 sec/request

GAME:

DEVIN SAVED PRODUCTION

+ Product Health
+ Users
+ Morale

THAT is our technical wow moment.

==================================================
4. THE THREE FOUNDERS
==================================================

Make the founders memorable.

Three founders:

KIRILL
Russian
Engineering / Product
Overconfident technical founder energy

Founder 2
Bangladeshi
Growth / Operations
Pragmatic, chaotic growth instincts

Founder 3
Colombian
Design / Sales
Charismatic, optimistic, occasionally dangerous ideas

IMPORTANT:

Do not make nationality the joke.

Comedy comes from startup personalities and decisions.

Each founder has:

morale
stress
energy
relationship state

Example:

Kirill
Morale: 78
Stress: 64

Founder 2
Morale: 91
Stress: 32

Founder 3
Morale: 67
Stress: 51

==================================================
5. GAME STATE
==================================================

Implement a centralized state object.

Example:

{
  "day": 1,

  "location": "Budapest",

  "stage": "Hackathon",

  "cash": 37,

  "revenue": 0,

  "monthlyBurn": 0,

  "runwayDays": 1,

  "users": 0,

  "activeUsers": 0,

  "traction": 0,

  "pmf": 0,

  "productHealth": 55,

  "technicalDebt": 40,

  "reputation": 10,

  "valuation": 0,

  "equity": {
      "founders": 100,
      "investors": 0
  },

  "founders": {
      "kirill": {
          "morale": 80,
          "stress": 20
      },

      "founder2": {
          "morale": 80,
          "stress": 20
      },

      "founder3": {
          "morale": 80,
          "stress": 20
      }
  }
}

Every important choice modifies state.

==================================================
6. MAIN GAME UI
==================================================

DO NOT build a boring SaaS dashboard.

This is a GAME.

Desktop-first.

Main layout:

┌──────────────────────────────────────────────────────┐
│ RUNWAY                         DAY 14 — DEBRECEN     │
│ €12,430    2,481 USERS    43 DAYS RUNWAY    ♥ 72    │
├──────────────────────────────────────────────────────┤
│                                                      │
│                                                      │
│                  GAME WORLD                          │
│                                                      │
│           characters / environment                   │
│           animations / events                        │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 🚨 PRODUCTION INCIDENT                               │
│                                                      │
│ 847 users arrived after a TikTok went viral.         │
│                                                      │
│ API latency: 4.2 seconds                             │
│                                                      │
│ [ SEND DEVIN ] [ IGNORE ] [ DISABLE FEATURE ]       │
│                                                      │
└──────────────────────────────────────────────────────┘

Top HUD:

💰 CASH
👥 USERS
🔥 BURN
⏱ RUNWAY
❤️ TEAM
⚙ PRODUCT

Values should animate when changing.

Example:

USERS

1,242
↓
1,118
↓
947

during an outage.

That creates tension.

==================================================
7. VISUAL STYLE
==================================================

The game needs personality.

Use:

dark startup aesthetic
warm environmental lighting
slightly exaggerated/cartoonish characters
beautiful typography
subtle gradients
animated numbers
particle effects where appropriate
camera movement
microanimations

Think:

indie management game

NOT:

enterprise dashboard.

If full 3D threatens delivery, use:

2.5D

or

stylized isometric environments.

Polished 2.5D > broken 3D.

Recommended:

React
TypeScript
Vite
Tailwind
Framer Motion

OPTIONAL:

React Three Fiber
Three.js

ONLY if we can get it working quickly.

==================================================
8. LOCATIONS
==================================================

The world changes as the startup grows.

LOCATION 1

BUDAPEST HACKATHON

Visual:

laptops
pizza
energy drinks
Devin branding-inspired hackathon environment
countdown clock

Starting state:

€37
0 users
0 revenue

----------------------------------

LOCATION 2

DEBRECEN APARTMENT

Cheap apartment.

Three founders.

Laptops everywhere.

Laundry.

Instant noodles.

Server alerts at 3 AM.

Money:

€412

Users:

327

Mood:

"Maybe this was a terrible idea."

----------------------------------

LOCATION 3

ACCELERATOR

Better office.

Whiteboards.

Investor meetings.

Coffee.

Numbers moving quickly.

----------------------------------

LOCATION 4

STARTUP HQ

Employees.

Servers.

Big screens.

Revenue.

Chaos.

----------------------------------

LOCATION 5

BALATON

This should be a comedic success scene.

Founders temporarily believe they've made it.

Then something terrible happens.

PHONE:

🚨 PRODUCTION DOWN

==================================================
9. OPENING
==================================================

Opening needs to be FAST.

BLACK SCREEN.

Text:

BUDAPEST
SEPTEMBER 19, 2026

Then:

COGNITION
DEVIN HACKATHON

Camera / scene reveals three founders.

Text:

3 FOUNDERS

€37

5 HOURS

1 AI ENGINEER

Then:

BUILD SOMETHING PEOPLE WANT.

Button:

START RUNWAY

==================================================
10. FIRST DECISION
==================================================

Give player startup ideas.

Example:

"What are we building?"

Option A

AI dating coach

Market:
Huge

Competition:
Terrifying

Difficulty:
Medium

Option B

AI debugging platform

Market:
Large

Competition:
High

Difficulty:
Hard

Option C

Generate something insane

If possible, use an LLM to dynamically generate:

company name
startup idea
tagline
initial market

But have deterministic fallback content.

==================================================
11. HACKATHON PHASE
==================================================

Countdown:

04:59:59

We do NOT actually wait five hours.

Game time accelerates.

Events happen.

Example:

FOUNDER:

"We need authentication."

CHOICES:

A. Build it properly
Time: -40 minutes
Tech debt: -5

B. Hardcode it
Time: -5 minutes
Tech debt: +20

C. Ask Devin
Time: variable
Engineering result: real

Another:

"Demo starts in 21 minutes."

Landing page isn't finished.

A:
Polish UI

B:
Fix backend

C:
Add another AI feature

D:
Let Devin decide

==================================================
12. HACKATHON RESULT
==================================================

Have judges score the team.

Categories:

PRODUCT
TECHNICAL
DEMO
CHAOS

Then:

YOU WON.

or:

YOU LOST.

IMPORTANT:

Losing does NOT end the game.

Example:

"You didn't win."

pause

"Unfortunately, somebody signed up."

USERS: 1

Then:

KEEP BUILDING?

[ OF COURSE ]

This is funny and moves into startup mode.

==================================================
13. STARTUP LOOP
==================================================

Main loop:

EVENT
   ↓
DECISION
   ↓
STATE CHANGE
   ↓
TIME PASSES
   ↓
NEW EVENT

Events include:

engineering
fundraising
growth
team
customers
infrastructure
legal
competition
random chaos

==================================================
14. EXAMPLE EVENTS
==================================================

----------------------------------

🚨 AWS BILL

AWS

Invoice:

€4,731

Cash:

€4,912

OPTIONS:

PAY IT

IGNORE AWS

ASK DEVIN WHY THE BILL IS SO HIGH

----------------------------------

🔥 PRODUCTION DOWN

Users online:

2,481

Revenue loss:

€12/min

OPTIONS:

WAKE KIRILL

SEND DEVIN

ROLL BACK

PRETEND NOTHING IS WRONG

----------------------------------

💰 INVESTOR

"We'd like to invest €250,000."

Valuation:

€1,000,000

Equity requested:

20%

OPTIONS:

ACCEPT

NEGOTIATE

DECLINE

ASK FOR €500K

----------------------------------

👨‍💻 EMPLOYEE

Your first engineer says:

"This codebase is fucking insane."

OPTIONS:

REFACTOR

IGNORE

SEND DEVIN

FIRE ENGINEER

----------------------------------

📈 VIRAL

Someone posted the product on TikTok.

Users:

1,281 → 18,492

Server health:

████████░░
██████░░░░
███░░░░░░░

Then:

🚨 DATABASE OVERLOADED

----------------------------------

☠ SECURITY

A researcher emails:

"I think I found something."

OPTIONS:

IGNORE

PAY €2,000

ASK DEVIN TO INVESTIGATE

PANIC

==================================================
15. DEVIN MODE
==================================================

When Devin is activated:

transition away from normal game view.

Screen:

DEVIN DEPLOYED

Then show something like:

MISSION
━━━━━━━━━━━━━━━━━━━━━━

Production latency has increased to 4.2s.

Investigate and fix the bottleneck.

CONSTRAINTS

✓ Preserve API behavior
✓ Tests must pass
✓ p95 < 500ms

Then live activity.

DEVIN

● Inspecting repository

● Reading API implementation

● Found N+1 query

● Implementing fix

● Running tests

Then:

VERIFICATION

Tests
████████████████
43 / 43

Latency

BEFORE
4.21s

AFTER
0.31s

Then huge:

INCIDENT RESOLVED

Return to game.

USERS:
-421 lost during incident

REPUTATION:
-3

PRODUCT HEALTH:
+18

This makes the technical operation understandable to nontechnical judges.

==================================================
16. DEVIN CAN FAIL
==================================================

VERY IMPORTANT.

Devin should not equal:

WIN BUTTON.

Sometimes:

DEVIN TASK FAILED

Tests:
41 / 43

The player chooses:

RETRY

ROLLBACK

SHIP ANYWAY

If player chooses:

SHIP ANYWAY

later:

🚨🚨🚨 PRODUCTION INCIDENT

Actions must have consequences.

==================================================
17. DEVIN INTEGRATION ARCHITECTURE
==================================================

Create an adapter.

interface EngineeringAgent {

    createTask(task): Promise<Task>

    getStatus(taskId): Promise<Status>

    getResult(taskId): Promise<Result>

}

Implementation:

DevinAgent

Game logic must NOT depend directly on Devin APIs.

This gives us fallback/demo safety.

Also implement:

MockAgent

for development.

Modes:

DEMO_MODE=mock

DEVIN_MODE=live

If Devin/API fails during presentation, the game MUST remain playable.

==================================================
18. REAL STARTUP REPOSITORY
==================================================

Create:

/startup-repo

Example:

startup-repo/
    backend/
        main.py
        database.py
        feed.py

    tests/
        test_api.py
        test_feed.py

    benchmark/
        benchmark_feed.py

    requirements.txt

Make it small.

Deliberately introduce problems.

INCIDENT 1:

slow endpoint

INCIDENT 2:

security issue

INCIDENT 3:

failing test

INCIDENT 4:

scaling problem

Each can correspond to game events.

Do NOT create complicated software.

The repository exists specifically to demonstrate:

Devin modifies REAL CODE.

==================================================
19. VERIFICATION ENGINE
==================================================

Never blindly trust agent output.

RUNWAY independently verifies.

Example:

EngineeringMission {

    id

    description

    verification: [
        {
            type: "command",
            command: "pytest"
        },

        {
            type: "benchmark",
            command: "python benchmark/benchmark_feed.py",
            threshold: 0.5
        }
    ]

}

After Devin completes:

RUNWAY runs verification.

Result determines gameplay.

This is essential.

==================================================
20. FUNDRAISING
==================================================

Add a simple fundraising mechanic.

Investor:

NORTHSTAR VENTURES

Offer:

€500,000

Pre-money:

€2,000,000

Dilution:

20%

Player can:

ACCEPT

COUNTER

WALK AWAY

If countering:

€3M

Investor response determined by:

traction
revenue
growth
reputation
randomness

Equity matters later.

==================================================
21. RUNWAY
==================================================

The title has double meaning.

RUNWAY =

how long company survives financially

AND

the path toward takeoff.

Calculate:

runwayDays =
cash / dailyBurn

Display prominently.

Example:

RUNWAY

127 DAYS

Then burn increases.

127

98

71

43

18

7

This should create tension.

==================================================
22. TEAM DYNAMICS
==================================================

Founders can become stressed.

Example:

3:47 AM

PRODUCTION DOWN

Kirill stress:
91%

Player:

WAKE KIRILL

SEND DEVIN

IGNORE UNTIL MORNING

If you repeatedly wake someone:

morale decreases.

Eventually:

COFOUNDER CRISIS

"I can't keep doing this."

Possible choices:

give vacation
increase equity
promise things improve
ignore
let them leave

==================================================
23. BALATON EVENT
==================================================

We need one absurd memorable scene.

Company has raised money.

Founders celebrate at Balaton.

Beautiful environment.

Music vibe.

Everyone relaxed.

Then phone notification.

AWS:

PRODUCTION INCIDENT

Users affected:

14,291

Player stares at phone.

Options:

SEND DEVIN

OPEN LAPTOP

IGNORE IT

THROW PHONE INTO LAKE

If:

SEND DEVIN

show Devin solving incident while founders continue celebrating.

This is an excellent visual demonstration of autonomous engineering.

==================================================
24. ENDGAME
==================================================

Eventually present:

ACQUISITION OFFER

€18,000,000

Your ownership:

52%

Your proceeds:

€9,360,000

Options:

SELL

KEEP BUILDING

Then:

VC GPT

final boss.

==================================================
25. VC GPT FINAL BOSS
==================================================

This can use an LLM if available.

Investor interrogates player.

Example:

VC:

"Your revenue grew 14% last month but infrastructure costs grew 41%.

Why?"

Player types/speaks answer.

VC responds dynamically.

Next:

"You own 31% of the company.

Would you raise another round?"

Use actual game state in the LLM context.

This means every playthrough produces a slightly different final conversation.

==================================================
26. ENDINGS
==================================================

Possible endings:

BANKRUPT

ACQUIRED

PROFITABLE INDIE COMPANY

UNICORN

COFOUNDER IMPLOSION

AWS KILLED YOU

TECHNICAL DEBT APOCALYPSE

DEFINITELY NOT A PONZI SCHEME

etc.

End screen example:

RUNWAY COMPLETE

1,847 DAYS

Peak valuation:
€1.2B

Revenue:
€83M ARR

Employees:
312

Founder ownership:
17%

Devin missions:
184

Production incidents survived:
37

Cofounders lost:
1

AWS spent:
€14.8M

Final result:

UNICORN

==================================================
27. POST-CREDIT SCENE
==================================================

After ending:

BLACK.

Text:

5 YEARS EARLIER

Budapest.

Same hackathon.

Judge:

"So... what did you build?"

Founders look at each other.

CUT TO BLACK.

RUNWAY

This should get a laugh.

==================================================
28. VOICE
==================================================

Voice would make this MUCH more compelling.

If implementation time permits:

allow player to speak decisions.

Example:

GAME:

Production is down.

"What do you want to do?"

PLAYER:

"Send Devin and tell him not to touch the payment service."

Speech → text.

Then mission becomes:

Investigate production outage.

Constraint:
DO NOT modify payment service.

This makes Devin feel like your actual employee.

However:

VOICE IS OPTIONAL.

Do NOT sacrifice gameplay or real Devin integration for voice.

==================================================
29. DYNAMIC DEVIN PROMPTS
==================================================

Engineering missions should be generated from:

game state
+
incident
+
repository state
+
player instruction

Example:

SYSTEM:

You are the lead engineer of a fictional startup represented by this repository.

You have been assigned a production incident.

Investigate the repository yourself.

Do not make unrelated modifications.

Preserve public behavior.

Run relevant tests.

MISSION:

The /feed endpoint has p95 latency above 2 seconds.

TARGET:

p95 < 500ms.

PLAYER CONSTRAINT:

Do not modify authentication.

When complete, summarize:

1. root cause
2. files changed
3. verification performed
4. remaining risks

==================================================
30. GAME EVENT ENGINE
==================================================

Represent events as data.

Example:

{
  id: "viral_spike",

  title: "YOU WENT VIRAL",

  description:
      "A TikTok creator posted your product.",

  conditions: {
      users: ">500"
  },

  choices: [
      {
          label: "Scale infrastructure",

          effects: {
              cash: -2000,
              productHealth: +10
          }
      },

      {
          label: "Send Devin",

          engineeringMission:
              "optimize_feed"
      },

      {
          label: "Do nothing",

          effects: {
              productHealth: -30,
              reputation: -10
          }
      }
  ]
}

This allows us to rapidly create content.

==================================================
31. MVP — WHAT WE ACTUALLY BUILD TODAY
==================================================

DO NOT attempt the entire game.

Build ONE INCREDIBLE VERTICAL SLICE.

Required:

1. Opening screen.

2. Three founders.

3. Budapest hackathon environment.

4. HUD:
   cash
   users
   runway
   product health
   team morale

5. 5–8 events.

6. State-changing decisions.

7. Transition:
   Budapest → Debrecen.

8. ONE real production incident.

9. ONE real Devin mission.

10. Devin modifies real startup repository.

11. Real verification.

12. Game responds to actual result.

13. One investor interaction.

14. One ending.

15. Polished animations/audio/visual feedback.

IF ALL ABOVE WORK:

add voice.

IF VOICE WORKS:

add Balaton.

==================================================
32. LIVE DEMO SCRIPT
==================================================

Design the entire product around this.

Presenter:

"We built a startup simulator."

Start.

BUDAPEST
SEPTEMBER 19, 2026

3 FOUNDERS
€37
5 HOURS

We make several ridiculous decisions.

Users appear.

Fast-forward.

DEBRECEN
DAY 41

Users:
2,184

Cash:
€1,280

Then:

YOU WENT VIRAL.

Users explode:

2,184
4,291
8,122
14,831

Then:

🚨 PRODUCTION DOWN

Latency:
4.8 sec

Revenue starts falling.

Presenter:

"Here's where the game stops being fake."

Click:

SEND DEVIN

Explain:

"This is an actual repository."

Devin receives actual task.

Show real activity.

Devin modifies repository.

Verification executes.

Tests:

43/43

Benchmark:

4.8 sec
→
0.34 sec

Return to game.

Users stabilize.

PRODUCT HEALTH +21.

Presenter:

"Devin didn't play the game.

Devin changed the game."

That is the line.

==================================================
33. CRITICAL DEMO SAFETY
==================================================

Never depend entirely on network/API latency.

Implement deterministic demo mode.

We need three layers:

LIVE
Real Devin.

CACHED
Previously completed real Devin mission replayed with authentic result.

MOCK
Fully simulated development mode.

For judging:

prefer LIVE.

If API/network breaks:

switch immediately to CACHED.

Never let the demo die.

==================================================
34. UI DETAILS

Numbers should feel alive.

When cash decreases:

€12,400
€11,982

brief negative indicator:

-€418

When users explode:

+1,284

When something breaks:

subtle screen shake.

When funding arrives:

+€500,000

big animation.

When Devin deploys:

change visual atmosphere.

Engineering mode should feel like:

MISSION CONTROL.

When tests pass:

strong satisfying feedback.

Do NOT cover everything in giant glowing gradients.

Keep it tasteful.

==================================================
35. SOUND

If trivial to implement:

keyboard sounds
notification
cash
error alarm
success
server incident

Audio must have mute control.

Do not spend substantial implementation time on this.

==================================================
36. CODE QUALITY

Ironically:

DO NOT VIBE-CODE THIS INTO ONE 20,000 LINE FILE.

Use something like:

/apps
    /game
        /src
            /components
            /scenes
            /events
            /engine
            /agents
            /state

/services
    /orchestrator

/startup-repo

/shared

Suggested concepts:

GameState
GameEvent
Choice
EngineeringMission
EngineeringResult
EngineeringAgent
VerificationResult

==================================================
37. ARCHITECTURE

Frontend
        │
        ▼
Game Engine
        │
        ├──────────→ Event Engine
        │
        ├──────────→ State Manager
        │
        └──────────→ Engineering Mission
                           │
                           ▼
                      Backend API
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
               Devin Adapter   Verifier
                    │             │
                    ▼             ▼
               Devin API     startup-repo
                    │
                    └──────┬──────┘
                           │
                           ▼
                   Mission Result
                           │
                           ▼
                       GAME STATE

==================================================
38. TECH STACK

Frontend:

React
TypeScript
Vite
Tailwind
Framer Motion

State:

Zustand

Backend:

FastAPI
Python

Agent:

Devin API

Verification:

Python subprocess
pytest
simple benchmarks

Optional 3D:

Three.js
React Three Fiber
Drei

Do NOT introduce databases unless absolutely necessary.

==================================================
39. PRIORITY ORDER

HOUR 0–1

GAME FIRST.

Build:

opening
HUD
founders
event system
choices
state

Use placeholder art if necessary.

HOUR 1–2

Make the game FUN.

Create:

5–8 events
Budapest
Debrecen
user growth
cash
runway
production incident

HOUR 2–3

Build:

startup-repo
engineering mission API
verification
Devin adapter

HOUR 3–4

Connect:

game
→ Devin
→ repository
→ verification
→ game

THIS IS THE MOST IMPORTANT HOUR.

HOUR 4–5

POLISH.

Animations.
Transitions.
Copy.
Sounds.
Bug fixing.

Only add voice/3D if core demo is already stable.

==================================================
40. WHAT NOT TO BUILD

DO NOT build:

complex economy simulation
multiplayer
authentication
accounts
database persistence
huge procedural world
real AWS infrastructure
20 engineering missions
complex character AI
perfect 3D assets
mobile version
inventory system
skill trees

None of this wins today's hackathon.

==================================================
41. THE JUDGES MUST REMEMBER THREE THINGS

After the demo they should be able to say:

1.

"They made a startup survival game."

2.

"Devin was literally the engineer inside the game."

3.

"The engineering tasks were REAL."

If they remember those three things:

we succeeded.

==================================================
42. PRODUCT PHILOSOPHY

Most AI demos are:

Prompt
↓
AI
↓
Text

RUNWAY is:

Decision
↓
Real engineering problem
↓
Devin
↓
Real code change
↓
Executable verification
↓
Game consequence

The boundary between:

SIMULATION

and

REALITY

disappears.

That is the experiment.

==================================================
43. FINAL INSTRUCTION

You are not producing a design document.

YOU ARE SHIPPING THE GAME.

Before coding, output ONLY:

1. repository structure
2. exact MVP implementation plan
3. interfaces between game and Devin
4. risks that could kill the demo

Keep that under 500 words.

Then immediately implement.

When choosing between:

MORE FEATURES

and

BETTER DEMO

always choose:

BETTER DEMO.

When choosing between:

FAKE COMPLEXITY

and

ONE REAL DEVIN ACTION

always choose:

ONE REAL DEVIN ACTION.

The final product should make someone laugh first...

...and then realize:

"Wait. Devin actually fixed that."

BUILD RUNWAY.
