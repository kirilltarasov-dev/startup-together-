# Paste-ready prompt for the infrastructure owner (Lane C infra + first real Devin run)

Copy everything between the lines into your Devin / coding agent on the machine that has the
Devin API key, GitHub, Railway, and Vercel access. It is self-contained. Do not paste secrets into chat.

---

You are setting up infrastructure for RUNWAY, a hackathon game (repo:
https://github.com/kirilltarasov-dev/startup-together-). Deadline is 14:59 CEST today; work fast,
verify each step, report the outputs listed at the end. Do not modify game code. Never print secrets.

CONTEXT
- The game lets a player "send Devin" to fix a real slow endpoint. Our server (FastAPI on Railway)
  creates a real Devin session against a small challenge repo, pulls the resulting commit, runs our
  own tests + benchmark, and the game reacts to the verified result.
- The challenge code lives in the folder `startup-repo/` of the main repo (FastAPI + SQLite, 9 pytest
  tests, `benchmark/benchmark_feed.py`). Its `backend/feed.py` has an intentional N+1 / full-scan
  bottleneck. DO NOT FIX IT. Devin must do the repair during the game.
- Hosting decision: Vercel = static frontend (`apps/game`, Vite) + a serverless route that holds
  `OPENAI_API_KEY` for gpt-live-1 voice sessions. Railway = FastAPI orchestrator container that
  holds `DEVIN_API_KEY` and serves `/api/missions`. Secrets stay server-side on each platform.

TASK 1 - Connect THIS repo to Devin (decision 13:00: Devin works in the main repo, no throwaway) (5 min)
1. Devin settings -> Integrations/GitHub -> install the Devin GitHub app on
   `kirilltarasov-dev/startup-together-`. Confirm Devin lists it as an available repository.
2. Record the current `main` SHA as BASELINE_SHA (the verifier rejects candidates that touch
   anything outside `startup-repo/`).
3. Devin must push to branches named `devin/*` only and never merge. Do not protect `main` in a way
   that blocks teammates; a simple "no force push" rule is enough.

TASK 2 - Devin API access check (5 min)
1. Verify the org has API access and note ACU/spending limits. Set a conservative per-session ACU
   limit for game sessions (2-3 ACUs) if the org settings allow it.
2. Do a read-only API call to list sessions (v3 org-scoped API per docs.devin.ai) to prove the key works.
   Report only "ok / status code", never the key.

TASK 3 - Start the FIRST REAL MISSION now (this produces our CACHED REAL RUN fallback) (5 min to start)
Create one Devin session on `kirilltarasov-dev/startup-together-` with this exact prompt (structured output requested):

  You are the lead engineer of a fictional startup. Work ONLY inside the folder startup-repo/ of
  repository kirilltarasov-dev/startup-together- (FastAPI + SQLite). Do not touch apps/, services/,
  docs/, or any file outside startup-repo/. Production incident: GET /feed is extremely slow under
  load. The cause is inside startup-repo/backend/feed.py (full table scan, Python-side sort,
  per-post and per-like queries). Fix the bottleneck so that get_feed(limit) preserves exactly the
  same output shape, ordering (newest first), like counts and pro_likes semantics. Do not change
  tests/, benchmark/, the database schema, or the HTTP API. Run pytest and the benchmark from inside
  startup-repo/ before and after. Push your work to a branch named devin/optimize-feed and do NOT
  merge or open a PR against main. Finish with a summary containing: root_cause, files_changed, before_seconds,
  after_seconds, tests_passed, tests_total, branch, commit_sha.

Record: session ID, session URL, start time. Do not wait for it; move to Task 4 and check back.

TASK 4 - Railway skeleton (10 min)
1. Create a Railway project + service "runway-orchestrator". Deploy a minimal FastAPI app with
   `GET /health -> {"ok": true}` (a two-file placeholder is fine; the real orchestrator code lands
   later on branch `feat/orchestrator` under `services/orchestrator/`).
2. Set env vars: `DEVIN_API_KEY`, `DEVIN_ORG_ID` (if applicable), `CHALLENGE_REPO=kirilltarasov-dev/startup-together-`, `CHALLENGE_PATH=startup-repo`,
   `BASELINE_SHA=<from task 1>`, `ORCH_TOKEN=<random 32 chars>` (shared secret the frontend route will send),
   `ALLOWED_ORIGIN=<vercel url once known>`.
3. Report the public Railway URL and confirm `curl <url>/health` returns ok.

TASK 5 - Vercel skeleton (10 min)
1. Create a Vercel project from the main repo with root directory `apps/game` (framework Vite,
   build `npm run build`, output `dist`). Deploy `main` as-is (it is a starter page; fine).
2. Set env vars: `OPENAI_API_KEY` (server-only, NOT prefixed VITE_), `ORCH_URL=<railway url>`,
   `ORCH_TOKEN=<same as railway>`. Enable preview deployments for branches.
3. Report the production Vercel URL.

TASK 6 - Check the Devin session (whenever Task 3 finishes)
Report its final status, status_detail, branch name, commit SHA, and the structured summary.
Do NOT merge the branch. Do NOT run the candidate code on your machine. Leave it for the verifier.

REPORT BACK (paste into the team chat, no secrets):
- BASELINE_SHA of main
- Devin repo connection: ok / not ok
- Devin API check: ok / status
- Session ID + URL + start time (+ final status, branch, commit when done)
- Railway URL (/health ok)
- Vercel URL
- ORCH_TOKEN: confirm it is set on BOTH platforms (do not paste the value)
- Anything that failed and the exact error text

---
