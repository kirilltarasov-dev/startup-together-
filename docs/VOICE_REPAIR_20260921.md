# Voice Repair - September 21, 2026

Scope: local repair and silent regression tests. No deployment, browser session,
microphone capture, paid provider call, or listening comparison was performed.
The September 19 browser/audio hold remains in force.

## Findings and Changes

- Compared `136775c` with `012d2cb`. The later revision removed Russian and
  Spanish voice preferences and substituted English voices with pitch changes.
  Restore Russian, Colombian-first Spanish, and Indian English preferences,
  with pitch 1. Sadman's character identity remains unchanged.
- Compact and novelty voices previously remained eligible in fallback paths.
  Exclude them in every path. When no acceptable voice exists, retain text
  instead of letting the browser silently choose an excluded default.
- Keep scripted character voices consistent whether GPT Live is connected or
  not. Do not sequence scripted lines using the old 400 ms live-silence heuristic.
- Explicit cancellation settles TTS promises even if the browser sends no
  end/error event. Reset and skip invalidate lines waiting for the live floor.
- Remove the competing always-on browser recognizer and timed dispatch from
  partial Live transcripts. Captions and button choices remain available.
- Change the choice router from forced guessing to optional, explicit choices.
  Keep the complete delegation configuration when updating context.
- Repair pending-connect cancellation, stale callback ownership, mute behavior,
  and input holds; expose cancellation while connecting.
- Synchronize HUD/SFX mute with speech mute. The old HUD control affected only
  sound effects.

Two GPT-5.6 Terra agents audited and implemented the Live lifecycle and router
repairs. The integrating agent reviewed their changes and added TTS/stage tests.

## Verification

The regular `npm test` command includes silent voice-selection, cancellation,
stage, command-matching, session-route, and mocked WebRTC regressions. Run
`npm run build` and `npm run lint` for integration checks.

Final local results: 34/34 tests passed; TypeScript and production build passed;
lint exited successfully with warnings in unchanged UI/3D files. The build
retains its existing large-chunk warning. `git diff --check` passed.

Publication validation: rebased the repair onto remote main `bc05363` in an
isolated worktree, preserving the newer rendering changes and their test list.
All 68 tests passed; production build and lint passed with existing warnings.
Original-worktree `AGENTS.md` and `docs/AUDIO_RECOVERY.md` changes were not included.

## Remaining Acceptance

- Locale selection is not acoustic verification. Russian/Spanish system voices
  reading English can vary by device. Spanish fallbacks other than `es-CO` are
  not verified Colombian voices; generic English fallbacks are not the requested
  accents. `ttsVoiceReport()` reports the selected voice and fallback rule.
- Obtain explicit permission for a short listening comparison before claiming
  the accents sound natural. No new recordings or neural TTS service were added.
- Verify the actual Azure deployment, session negotiation, delegation, playback,
  and speaker echo in an authorized live test. Mocked tests do not prove provider
  availability or acoustic behavior.
- Live speech-energy detection remains heuristic for unscripted replies.
  The session route's existing in-memory rate limit remains best-effort, not a
  durable public spending-control system.
