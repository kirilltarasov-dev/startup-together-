# Game-to-Devin Contract

Status: **PROPOSED. No provider calls, paid sessions, or candidate execution performed.**

## Trust Boundary

The browser requests one allowlisted mission, `optimize_feed`. The orchestrator
owns repository URL, frozen baseline SHA, allowed paths, verification policy,
credentials, timeout, and spending limit. No browser-provided commands or targets.
Game logic consumes our result schema, not raw Devin responses.

Proposed provider adapter: `createTask`, `getStatus`, `getResult`, and cancellation
of an authorized active task. The adapter normalizes provider details.

## Minimal HTTP Surface

| Endpoint | Request / response |
| --- | --- |
| `POST /api/missions` | `runId`, `incidentId`, `idempotencyKey`; returns mission ID and status |
| `GET /api/missions/{id}` | Normalized lifecycle, mode, sanitized session metadata, optional verified result |
| `POST /api/missions/{id}/cancel` | Stops/terminates the authorized live task where supported; records actual outcome |

Only the configured incident is accepted. Mode is server-controlled in LIVE;
a client cannot promote MOCK/CACHED to LIVE or select a different repository.

Result fields: `missionId`, `runId`, `mode`, `outcome`, `sessionId`, `sessionUrl`,
`baselineCommit`, `candidateCommit`, `verifiedAt`, `verification`, and `error`.
`verification` contains actual passed/failed counts, benchmark unit/sample count,
before/after measurements, harness revision, and an evidence reference.
An unverified result cannot have a success outcome.

Lifecycle:

```text
queued -> running -> awaiting_verification -> succeeded | failed
   \          \              \
    +---------> needs_attention | timed_out | cancelled
```

`needs_attention` is not success or proof of failure. Preserve actual provider
status/detail for diagnosis; expose only sanitized information to the browser.

## Current Provider Findings

Official docs describe v3 organization-scoped session creation and retrieval.
Creation supports repository selection, structured-output schema, and an ACU
limit. Create and read permissions are distinct [S15-S17 in `RESEARCH.md`].
Confirm the hackathon account supports this API before implementing against it.

An API session can report `status=running` with `status_detail=finished`; do not
wait for an invented `completed` status. Waiting for user/approval, exhausted
credits, errors, and suspension need explicit mappings. Structured output and
a claimed successful task are inputs to verification, never authority to award success.

## Idempotency, Time, and Cost

- One active live mission. Repeated clicks return the same mission for the same key.
- Refresh/restart must not silently buy another session.
- If creation times out ambiguously, reconcile or request attention; do not blindly retry.
- Poll with backoff; respect throttling and finite request timeouts.
- Set an approved provider spending cap and a separate application deadline.
- User cancellation and replay switching must account for still-running paid work.
- Match mission ID/run ID; apply a terminal result once; reject results from earlier games.
- Do not auto-merge, force-push, or deploy a candidate.

## Candidate and Verifier

Preferred target: a dedicated disposable challenge repository, seeded from the
approved `startup-repo/` snapshot. Creation/access require the owner's approval.
If using a branch in this repository instead, freeze the baseline, reject changes
outside approved challenge paths, and do not grant authority to merge game changes.
Path checks are validation, not a substitute for repository permission isolation.

Verification steps:

1. Freeze the baseline, trusted tests, dataset/seed, benchmark, and acceptance rule.
2. Measure baseline in the same runner configuration to be used for the candidate.
3. Ask Devin to preserve feed behavior and optimize the bottleneck; do not pre-fix it.
4. Obtain exact candidate commit from the approved remote; validate ancestry and changed paths.
5. Run candidate code in a disposable restricted container/runner: no API/Git secrets,
   no host credentials, no Docker socket, no broad host mounts, no network, bounded
   CPU/memory/time, and a private temporary filesystem. Fetch dependencies outside it.
6. Execute verifier-owned tests and benchmark. Do not run candidate-controlled CI,
   setup scripts, test overrides, or arbitrary commands suggested by the agent.
7. Compare behavior and measurements, then emit the trusted result and evidence.

Subprocess execution on the developer machine is not isolation. If a suitable
runner is unavailable, the real-verification gate remains open; use a disclosed
previously verified run only if one genuinely exists.

## Baseline Findings to Address Before the First Mission

- Nine test functions exist in the received starter; none have been run here.
- The benchmark calls `get_feed` directly. Its numbers are function timings in
  seconds, not HTTP endpoint latency, concurrent-load results, or production telemetry.
- Default `BENCH_N` is 12; choose enough samples and a repeatable workload before
  claiming improvement. Do not pick a threshold after seeing the candidate result.
- The example 500 ms target may already be met on the demo machine; measure first.
- Tests and benchmark currently use fixed temporary database names. Isolate each run.
- `init_db` removes/reseeds its database; it must never target shared or real data.
- Tests inside the candidate can be edited. Independent checks must live outside it.

These are planning observations, not failed-test results or implemented fixes.

## Three Honest Modes

| Mode | What it means | Required presentation |
| --- | --- | --- |
| LIVE | This action created the recorded real task; independent verification decides outcome | Actual session/status and measured result |
| CACHED REAL RUN | Replay of an authentic earlier Devin task and independent verification | Visible replay label, original timestamp, commits and evidence |
| MOCK | Deterministic simulated development fixture | Visible mock label; never described as real engineering |

Switching modes is explicit. A replay must not reuse a live session ID or invent
progress for that live task. A failed LIVE task can remain failed while the demo
separately shows a labelled prior run. No real cached run exists yet.

The latest user direction requires a playable hosted game, likely Vercel/Railway.
Follow `HANDOFF.md` for server-only Vercel provider routes and Railway orchestration.
Authenticate/authorize paid operations and apply spending/rate limits. CORS alone
is not authorization. Teammates' coding-agent access does not automatically prove
the in-game mission API credentials work; the integration owner verifies that separately.
