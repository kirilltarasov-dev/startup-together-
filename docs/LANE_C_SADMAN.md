# Paste-ready prompt for SADMAN's Devin — Lane C: backend / Devin orchestrator / verifier

Copy everything between the lines into your Devin. Work on branch `feat/orchestrator`.
Deadline 14:59 CEST. Report back in team chat every 20 minutes: last working result, blocker, next step.

---

You are Lane C (backend) for RUNWAY, a hackathon game. Repo: https://github.com/kirilltarasov-dev/startup-together-
Read first: `AGENTS.md`, `docs/HANDOFF.md`, `docs/DEVIN_CONTRACT.md`, `docs/SKIT.md` (section E04), `docs/COLLEAGUE_SETUP_PROMPT.md`.
Deadline 14:59 CEST today. Work on branch `feat/orchestrator`. Never print secrets.

YOU OWN (write only here): `services/orchestrator/**`, `apps/game/src/agents/httpAgent.ts`, `cache/**`, Railway config.
DO NOT EDIT: anything else under `apps/game/` (Lane A = Kirill), `apps/game/src/voice/` (Lane V = Sergio), `startup-repo/` (the challenge; never fix its bug), `docs/` frozen files.

WHAT THE GAME DOES
The player clicks/says "Send Devin" during a fake production incident. Our FastAPI on Railway creates a REAL Devin
session on this repo, Devin fixes the N+1 in `startup-repo/backend/feed.py` on a `devin/*` branch, we fetch that
branch and run OUR OWN pytest + benchmark, and the verified result drives the game. Devin's own claims are never trusted.

TASK 1 — Orchestrator skeleton on Railway (target 13:10)
- `services/orchestrator/main.py` (FastAPI), `requirements.txt`, `Dockerfile` (python:3.12-slim + git), `railway.json` optional.
- Env: `DEVIN_API_KEY`, `CHALLENGE_REPO=kirilltarasov-dev/startup-together-`, `CHALLENGE_PATH=startup-repo`,
  `BASELINE_SHA`, `ORCH_TOKEN`, `ALLOWED_ORIGIN`, `PORT`.
- Every `/api/*` route except `/api/health` requires header `X-Runway-Key: <ORCH_TOKEN>`. CORS for ALLOWED_ORIGIN + localhost:5173.
- `GET /api/health` → `{"ok": true, "mode": "live"|"cached"|"mock"}`.
- Deploy to Railway, confirm `curl <url>/api/health`. Post the URL in chat.

TASK 2 — Mission API (exact contract; the frontend is already coded against it)
POST /api/missions
  body: { "runId": string, "incidentId": "optimize_feed", "idempotencyKey": string, "playerConstraint"?: string }
  → 200 { "id": string, "phase": Phase, "mode": Mode }
  Rules: only incidentId "optimize_feed" (else 400). Same idempotencyKey → same mission (never a second paid session).
  At most ONE live mission running at a time; if one is running, return it with 200 and `"attached": true`.
  playerConstraint: max 200 chars, strip newlines/backticks/URLs, reject shell-like tokens (rm , curl, sudo, git push, token, key).
  Appended to the Devin prompt as `PLAYER CONSTRAINT: ...`. It can never change repo, commands, thresholds or spending.

GET /api/missions/{id}
  → MissionStatus:
  {
    "id": string, "runId": string,
    "mode": "live" | "cached" | "mock",
    "phase": "queued" | "running" | "awaiting_verification" | "succeeded" | "failed" | "needs_attention" | "timed_out" | "cancelled",
    "elapsedSec": number,
    "statusDetail"?: string,          // sanitized provider status, e.g. "devin: running / finished"
    "sessionUrl"?: string,            // real Devin session URL (live) or the original one (cached)
    "log": [ { "t": number, "text": string, "kind"?: "info"|"tool"|"ok"|"err" } ],   // ONLY real facts: our own steps + provider status changes. Never invent Devin activity.
    "result"?: {
      "success": boolean,             // true ONLY if our verifier passed both checks
      "summary": string,              // Devin's structured summary (root_cause) — display only
      "verification": {
        "tests": { "passed": number, "total": number, "ok": boolean },
        "benchmark": { "before": number, "after": number, "threshold": number, "unit": "s", "samples": number, "ok": boolean },
        "filesChanged": string[],
        "baselineCommit": string, "candidateCommit": string
      },
      "verifiedAt": string
    },
    "error"?: { "code": "provider_down"|"credits"|"auth"|"timeout"|"outside_allowed_paths"|"internal", "message": string }
  }
  A result with success=true MUST have verification attached. An infra error is `needs_attention` + `error`, never `failed`.

POST /api/missions/{id}/cancel → best effort, returns MissionStatus.

TASK 3 — Devin adapter (v3 org API, docs.devin.ai)
- Create session on CHALLENGE_REPO with the prompt from `docs/COLLEAGUE_SETUP_PROMPT.md` TASK 3 (+ PLAYER CONSTRAINT line).
  Request structured output: { root_cause, files_changed, before_seconds, after_seconds, tests_passed, tests_total, branch, commit_sha }.
  Set the per-session ACU limit (2–3) if the API allows.
- Poll with backoff (5s → 15s). Map provider statuses per DEVIN_CONTRACT.md. `status=running` with `status_detail=finished` counts as done.
- Application timeout 8 min → `timed_out`.

TASK 4 — Verifier (this is the whole point; be strict)
- Benchmark recalibration (approved): the verifier owns its OWN copy of tests + benchmark (copy from `startup-repo/tests`
  and `startup-repo/benchmark` into `services/orchestrator/verifier/` at BASELINE_SHA; never read them from the candidate).
  Seed size for the verifier benchmark: large enough that baseline p95 is clearly slow (~2s; try 200k–500k posts via
  `init_db(n_users=..., posts_per_user=...)`) and freeze threshold **0.5 s**. Measure the baseline once at startup and cache it.
- On Devin completion: `git fetch origin devin/*`, resolve candidateCommit, check ancestry from BASELINE_SHA, and `git diff --name-only BASELINE..candidate`
  must be entirely under `startup-repo/backend/`. Anything else → `failed` with error code `outside_allowed_paths`.
- Run candidate in an isolated runner: separate temp dir, `env -i` minimal env (no DEVIN_API_KEY/ORCH_TOKEN/git creds), `timeout 120`,
  its own temp DB paths. Docker-in-Railway is not available; document that this is process-level isolation, not a container.
- success = tests all pass AND benchmark p95 < 0.5s. Fill verification exactly as above.

TASK 5 — CACHED REAL RUN
- As soon as one live mission verifies (the infra owner may already have started one — check `devin/optimize-feed` branch),
  save the full MissionStatus timeline to `cache/optimize_feed.json` in the shape:
  { "log": [[secondsOffset, text, kind], ...], "result": <result above>, "sessionUrl": ..., "recordedAt": ... }
  and commit it. The frontend replays it when mode=cached. Never fabricate this file.

TASK 6 — MOCK mode
- If `DEVIN_API_KEY` is unset, the server runs in mock mode: same endpoints, scripted phases, result flagged `"mode": "mock"`.
  The frontend already has its own mock; this just lets local dev hit the real API shape.

VERIFY BEFORE HANDOFF
- `curl -H "X-Runway-Key: $ORCH_TOKEN" -X POST <url>/api/missions -d '{"runId":"t1","incidentId":"optimize_feed","idempotencyKey":"t1"}'`
- Poll GET until terminal. Paste the final JSON (no secrets) in chat.
- Give Kirill: Railway URL and confirm ORCH_TOKEN is set on Vercel as `VITE_RUNWAY_KEY`?? NO — the browser must not hold ORCH_TOKEN.
  Instead expose the mission API through Vercel proxy functions `apps/game/api/missions/*.ts` that add the header server-side.
  Coordinate with Kirill before creating files under `apps/game/api/` (Sergio also uses that folder for voice).

Report every 20 min. Commit small, push to `feat/orchestrator`, tell Kirill when the contract is live so he can switch VITE_AGENT_MODE=live.

---
