# RUNWAY

A startup survival game where Devin is your actual AI engineer.
Brief: [RUNWAY.md](./RUNWAY.md)

## Play Modes

- **START RUNWAY** retains the original five-decision demo and its existing voice/Devin moments.
- **NEW CAMPAIGN** starts an extended beta: 35 encounters across five chapters, conditional scenes that remember earlier choices, optional founder conversations, trust, technical debt, daily cashflow and multiple endings. Reuses the three existing locations and the single engineering mission; no additional paid missions are added.
- **SAVE & TITLE / RESUME CAMPAIGN** use browser-local storage. New campaign replaces that local save. A resumed interrupted mission uses the disclosed manual workaround rather than starting another paid task; it does not cancel a remote session that may still be running.

An hour of play is a design target, **not measured or guaranteed**. There are no artificial waiting timers to pad campaign length. The short demo stays available.

From `apps/game`, run `npm test`, `npm run lint`, and `npm run build`. With a development/preview server running, `TEST_URL=http://127.0.0.1:5182 node scripts/campaign.browser.mjs` checks all 35 encounters, save/reload/resume and switching back to the demo without calling paid APIs. `npm run test:browser` remains the manual five-event regression (set `TEST_URL` to your server).

## Layout

```
apps/game/               React + Vite + Tailwind + Framer Motion + Zustand (the game)
services/orchestrator/   FastAPI: runs real Devin missions against startup-repo + verifies
startup-repo/            The fictional startup's REAL code (deliberately broken)
shared/                  Mission definitions shared by game + orchestrator
cache/                   Recorded real Devin runs for CACHED demo mode
```

## Architecture

```
PLAYER  (clicks / gpt-live-1 voice via WebRTC and Vercel session route)
  |
  v
FRONTEND  apps/game  -> VERCEL
  Scenes -> Event Engine -> GameState -> HUD / World
                 |  choice.engineeringMission + player constraint
                 v
        EngineeringAgent (interface)
          MockAgent    VITE_AGENT_MODE=mock    dev only
          CachedAgent  VITE_AGENT_MODE=cached  replays a recorded real run
          HttpAgent    VITE_AGENT_MODE=live    -> backend
                 |  POST /missions, GET /missions/{id} (poll)
                 v
BACKEND  services/orchestrator  -> RAILWAY   (secret: DEVIN_API_KEY)
  1. build prompt from mission + game state + constraint
  2. DevinAdapter -> Devin cloud API (or CLI subprocess locally)
  3. wait for branch
  4. Verifier (independent): git fetch, pytest, benchmark_feed.py, git diff
  5. EngineeringResult -> game
                 |
                 v
DEVIN CLOUD  api.devin.ai   real session in its own sandbox
  clones repo, edits startup-repo/backend/feed.py, runs tests, pushes branch
                 |
                 v
GITHUB  kirilltarasov-dev/startup-together-  (startup-repo/ has a deliberate N+1)
                 ^
  Railway git-fetches the branch to verify independently

Fallback layers on Vercel: live -> cached -> mock. The game never dies.
```

## Run

```
# python
python3 -m venv .venv && .venv/bin/pip install fastapi uvicorn pytest httpx
.venv/bin/uvicorn services.orchestrator.main:app --port 8000 --reload

# game
cd apps/game && npm i && npm run dev        # http://localhost:5173
```


## Deploy

- **Frontend -> Vercel.** Root `apps/game`. Env: `VITE_API_URL=https://<railway-app>.up.railway.app`, `VITE_AGENT_MODE=live`.
- **Backend -> Railway.** Root `services/orchestrator` (Dockerfile). Secrets: `DEVIN_API_KEY`, `RUNWAY_KEY` (shared header so strangers can't burn credits), `GITHUB_REPO=kirilltarasov-dev/startup-together-`.
- Devin's GitHub app must have access to the repo so it can push branches.
- Local fallback: run both on the presenter's laptop; backend can use the Devin CLI (`AGENT_BACKEND=cli`) instead of the API.
- If anything is down: set `VITE_AGENT_MODE=cached` on Vercel. The game replays a recorded real Devin run.

## Production Docs (frozen 12:55 CEST — read before coding)

| File | Purpose |
| --- | --- |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Latest approved decisions, lanes A/B/C/V, cut order |
| [docs/SKIT.md](docs/SKIT.md) | Frozen script: every event, line, choice ID, effect |
| [docs/DIRECTION.md](docs/DIRECTION.md) | 3D spec: camera, palette, primitives, drei helpers, 8 animations, movement |
| [docs/VOICE.md](docs/VOICE.md) | gpt-live-1 contract: system prompt, `choose` tool, per-event context |
| [docs/DEVIN_CONTRACT.md](docs/DEVIN_CONTRACT.md) | Mission lifecycle, verifier, LIVE / CACHED / MOCK honesty |
| [docs/PLAN.md](docs/PLAN.md) | Milestones, task board, decisions |
| [docs/COLLEAGUE_SETUP_PROMPT.md](docs/COLLEAGUE_SETUP_PROMPT.md) | Paste-ready infra setup for the key/hosting owner |
| [AGENTS.md](AGENTS.md) | Working rules for coding agents |
