# Performance and Quality

Visual ambition and responsiveness are both acceptance criteria. Target at least 30 FPS on the declared demo device, 60 preferred. Do not claim a device-wide result from a short headless sample.

## Quality contracts

| Control | High | Medium | Low |
| --- | --- | --- | --- |
| DPR cap | 1.5 | 1.25 | 1 |
| Sun shadow map | 2048 | 1024 | 512 or disabled |
| Vegetation density | full approved budget | reduced distant density | sparse distant density |
| Water reflection | higher resolution/update rate | reduced | inexpensive environment response |
| Contact enhancement | only if profiled | optional | off |
| Bloom/grading | restrained | restrained | off where costly |

These are starting configuration values, not benchmark conclusions. Expose expensive effects independently. Do not reduce texture fidelity blindly before locating the bottleneck.

## Telemetry definitions

Record FPS and frame-time median/p95 over a stated window, renderer draw calls/triangles, geometry/texture counts, loaded-sector count, asset bytes and load/decode duration. Count shadow-casting objects separately. Texture GPU-memory values are estimates derived from dimensions/formats/mips; `renderer.info.memory.textures` is a count, not bytes. Browser resource transfer sizes may be zero under caching/cross-origin restrictions; label that condition instead of inventing sizes.

Measure a repeatable route: interior -> door -> courtyard -> vegetation -> pond -> return. Fix camera/resolution/tier, note browser/device and warm/cold cache. Capture screenshots alongside timing so an optimization cannot silently remove visual content. Compare before/after for instancing, shadow changes, codecs, LOD and WebGPU.

## Regression gates

No blank render, missing textures, floor fall-through, camera clipping or control lock-up. Input, story choices, save/restart and the manual incident path stay testable without paid APIs. Narrow/touch controls must remain usable even though desktop is primary.

Baseline release has geometry/download-budget tests and short headless frame samples in ASSETS.md, not full telemetry or certified sustained performance. The first production JS bundle is above Vite's large-chunk warning; code splitting and asset residency are opportunities, not reasons to disable warnings.
