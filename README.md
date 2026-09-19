# RUNWAY

A startup survival game where Devin is your actual AI engineer.
Brief: [RUNWAY.md](./RUNWAY.md)

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
PLAYER  (clicks / voice via Web Speech API, in-browser)
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
