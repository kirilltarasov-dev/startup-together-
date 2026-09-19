# Paste-ready prompt for SERGIO's Devin — Lane V: voice (gpt-live-1)

Copy everything between the lines into your Devin. Work on branch `feat/voice`.
Deadline 14:59 CEST. Report back in team chat every 20 minutes: last working result, blocker, next step.

---

You are Lane V (voice) for RUNWAY, a hackathon game. Repo: https://github.com/kirilltarasov-dev/startup-together-
Read first: `AGENTS.md`, `docs/HANDOFF.md`, `docs/VOICE.md` (the contract — follow it exactly), `docs/SKIT.md` (E01, E04, E05).
Deadline 14:59 CEST today. Work on branch `feat/voice`. Never print secrets.

YOU OWN (write only here): `apps/game/src/voice/**`, `apps/game/api/voice/**` (Vercel serverless route), `apps/game/vercel.json` if needed.
DO NOT EDIT: anything else in `apps/game/src/` (Lane A = Kirill), `services/` (Lane C = Sadman), `startup-repo/`, `docs/` frozen files.
If you need a dependency added, ask Kirill in chat (he owns package.json / lockfile). Prefer zero new deps: WebRTC is native.

WHAT VOICE DOES
Three "talk moments" (E01, E04, E05). The player presses "Talk", speaks, the model answers in character (<=2 sentences,
as Sadman/Sergio or the investor) and MUST resolve the event by calling the `choose` tool with a legal choiceId.
The game applies exactly the same action as a button click. Buttons always remain. Voice is never a single point of failure.

INTERFACE WITH THE GAME (Kirill provides this file; code against it, do not modify it)
`apps/game/src/state/voiceBridge.ts` exports:
  getVoiceContext(): null | {
    eventId: 'E01' | 'E04' | 'E05',
    contextText: string,                 // the ready-made event context block from VOICE.md with live numbers filled in
    allowedChoices: { id: string; label: string }[]
  }
  dispatchVoiceChoice(eventId: string, choiceId: string, constraint?: string): boolean   // false = rejected (illegal id / stale event)
  subscribeVoiceContext(cb: (ctx) => void): () => void                                    // fires when the current event changes
You also export from `apps/game/src/voice/index.ts`:
  <VoiceButton />   — self-contained: Talk / Mute / Disconnect, status badge ("Voice unavailable" on denial/unsupported/network),
                      live caption of what the model said. Kirill mounts it inside the decision panel. Must render nothing harmful if the
                      session route is missing (show "Voice unavailable").

TASK 1 — Server route (target 13:15)
- `apps/game/api/voice/session.ts` (Vercel Node function). Reads `OPENAI_API_KEY` (server-only, NOT VITE_).
- Mints an ephemeral client secret for a gpt-live-1 session per the official Live API WebRTC quickstart
  (https://developers.openai.com/api/docs/guides/live.md , https://developers.openai.com/api/docs/models/gpt-live-1.md).
  Confirm the exact endpoint/body/tool-call event names against those docs BEFORE writing the client — do not guess.
- Include in the session config: the base system prompt from VOICE.md verbatim, the `choose` tool definition from VOICE.md,
  voice output enabled, English, server VAD. Max session length 10 minutes.
- Rate limit: max 3 sessions per IP per 10 minutes (in-memory Map is fine). Return 429 otherwise.
- Test locally with `vercel dev` or by deploying a preview of `feat/voice`. `curl -X POST <preview>/api/voice/session` → token JSON.

TASK 2 — Browser client `apps/game/src/voice/liveClient.ts`
- On "Talk" click only: getUserMedia (mic), fetch `/api/voice/session`, open RTCPeerConnection + data channel per quickstart, attach remote audio.
- On each `getVoiceContext()` change: send `session.update` with the `contextText` so the model only knows legal choices right now.
- Handle the tool-call event: parse `{eventId, choiceId, constraint}`, sanitize `constraint` (strip newlines/backticks/URLs, cap 200 chars,
  reject if it contains `rm `, `curl`, `sudo`, `git push`, `token`, `key`), then `dispatchVoiceChoice(...)`. Send the tool result back
  ("ok" or "rejected: <reason>") so the model can react. Show model text as a caption; anything not a tool call does nothing.
- Denied mic / unsupported browser / fetch fail → badge "Voice unavailable", no crash, buttons still work.
- Mute toggles the local audio track; Disconnect closes pc + tracks; also close on `getVoiceContext() === null` for >10 minutes.

TASK 3 — `<VoiceButton />` UI
- Small, dark, matches the game (Tailwind classes; the app uses Tailwind v4 + framer-motion, both already installed).
- States: idle "🎤 Talk", connecting, listening (pulsing ring), speaking (caption), unavailable. Mute + Disconnect icons while open.
- Keyboard accessible. Nothing blocks the choice buttons.

ACCEPTANCE (from VOICE.md / QUALITY.md)
- Each of E01, E04, E05 resolves via `choose` and produces the same state change as the button.
- Illegal choiceId → rejected + console.warn; buttons still work.
- Mic denial, mute, disconnect, restart mid-session tested.
- `grep -r "sk-" apps/game/dist/` after `npm run build` returns nothing.
- Deployed Vercel preview of `feat/voice` works signed-out in Chrome.

Report every 20 min. When `<VoiceButton />` + bridge integration compile, tell Kirill so he merges `feat/voice` into the app.

---
