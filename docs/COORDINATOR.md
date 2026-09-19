# Production Coordinator

Owner: **Codex in this window**. Executive approval: **user**.
Working deadline: September 19, 2026, **14:59 CEST**, from the user's confirmation.
Do not restart the clock. The organizer's exact deadline overrides this estimate.

## Read First

The reduced scope is approved: three scenes, three founders, five events, one
real engineering mission, investor choice, ending, hosted play, and requested voice.
The next job is delivery, not another round of general architecture research.

- [HANDOFF.md](HANDOFF.md): latest scope and authoritative agent/branch claims.
- [SKIT.md](SKIT.md): playable script draft, choices, and proposed game effects.
- [PLAN.md](PLAN.md): authoritative implementation task status and milestones.
- [QUALITY.md](QUALITY.md): evidence required before we call something complete.

No game code or paid agent session is produced by this coordination window.
Teammates' external progress is unknown until they report a branch/build here.

## Who Produces What

| Responsibility | Accountable owner | Output / next handoff |
| --- | --- | --- |
| Scope, deadline, budget, final creative approval | User | Approve skit choices; identify two teammate owners |
| Skit and event script | Codex | Draft in `SKIT.md`, then user review and freeze |
| Production coordination and blockers | Codex | Keep this file, handoff, and task board aligned |
| Art direction | Codex drafts; user approves; lane B implements | Three compositions, distinct characters, asset list in `DIRECTION.md` |
| Game logic and frontend integration | Teammate 1 proposed; name unassigned | Lane A: approved events, state, HUD, voice/button actions |
| Three scenes and founder visuals | Teammate 1 proposed, possibly a separate Devin agent | Lane B: isolated scene/asset branch; A integrates |
| Devin, voice, verification, hosting services | Teammate 2 proposed; name unassigned | Lane C: contract, bounded provider calls, evidence, deployment |
| Release QA | Both teammates; Codex reviews supplied evidence | Independent playthrough against `QUALITY.md` |
| Stage pitch and submission | User, with Codex script assistance | Rehearsal, playable public URL, submission receipt |

These are proposed human allocations, not claims that agents have been started.
The two teammates may run multiple Devin agents in separate worktrees. Every
branch still needs one accountable human and a claimed write area in `HANDOFF.md`.

## Script-to-Code Checklist

| Step | Current status | Acceptance / responsible person |
| --- | --- | --- |
| Original vision read | DONE | `RUNWAY.md` preserved; Codex reviewed it |
| Reduced scope approved | DONE | User approved, amended to three scenes and voice |
| First skit draft written | REVIEW | `SKIT.md` exists; user approves tone, beats, and effect values |
| Three characters specified | DONE | Russian Kirill, Bangladeshi growth founder, Colombian design founder |
| Display names for founders 2/3 | OPEN | User provides names; stable IDs allow coding meanwhile |
| Third scene setting | PROPOSED | Accelerator/investor room; user may rename without adding systems |
| Five event rules frozen | REVIEW | Lane A confirms effects and ending rules with user |
| Technical contract ready | DRAFT READY | A/C review `ARCHITECTURE.md` and `DEVIN_CONTRACT.md` |
| Coding lanes claimed | OPEN | Two teammates record ownership and branches in `HANDOFF.md` |
| Provider/hosting access checked | UNVERIFIED | Lane C checks access, budget, and protected endpoints |
| Working build integrated | UNVERIFIED | Supply build/branch plus a playable URL |
| Docs shared through GitHub | NOT PUSHED | Requires explicit user commit/push instruction |

Script review must not block independent API access checks or scene blockout.
Do not freeze gameplay values silently: label provisional values, obtain one
short approval, then stop re-litigating them during implementation.

## Next Five Minutes

1. User identifies the two coding owners and confirms their current branches.
2. Codex presents the skit draft; user approves or gives concrete changes.
3. A/C agree event IDs, mission result shape, and voice-to-choice validation.
4. B blocks out three scenes using stable character IDs and shared scene state.
5. C verifies the in-game Devin API separately from teammates' coding-agent access.

## Checkpoint Protocol

Use the absolute checkpoints in `PLAN.md`. At each active check-in, request:

```text
Owner / lane:
Branch and commit:
Working now:
Evidence or playable URL:
Current blocker:
Next deliverable and ETA:
Shared-file or dependency request:
```

The coordinator then records DONE only with evidence, resolves conflicting file
ownership, and asks the smallest blocking question. Escalate a blocker after
five minutes; integrate at least every twenty minutes. No implied background
monitoring: this window checks progress when active or when the team reports.

## Change Control

- User controls scope and creative approval; Codex maintains the written record.
- Original source stays in `RUNWAY.md`; playable adaptation stays in `SKIT.md`.
- Keep art decisions in `DIRECTION.md`, implementation status in `PLAN.md`, and
  branch claims in `HANDOFF.md`. Link rather than duplicate their full contents.
- No fourth scene, second engineering mission, physics, custom rigs, or extra
  game systems. Raise additions with their cost and what would be removed.
- A controls the frontend lockfile and shared composition.
- C controls service configuration and API contracts; coordinate changes with A.
- Last thirty minutes are release fixes, hosted play checks, rehearsal, and submission.
