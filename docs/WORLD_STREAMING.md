# World Residency and Streaming

Target hierarchy: World -> Region -> Sector. The first region is the workspace/courtyard/pond slice, not an entire city. Split interiors from exterior geometry. Do not flatten the world into one giant GLB.

## Sector descriptor

Each stable ID records bounds, neighbor IDs, visual asset references, collision descriptors, interaction volumes, NPC placements, audio references and lighting metadata. Descriptors are data; gameplay does not import raw loader internals. Keep light/shared gameplay state outside sectors so unload/reload cannot restart a mission or duplicate an event reward.

## Residency rules

- Current/near sectors: full required visual and collision residency.
- Adjacent sectors: preload asynchronously, with bounded concurrency and a grace margin around thresholds.
- Far sectors: low-detail shell or unloaded, using hysteresis to prevent boundary thrashing.
- Collision readiness precedes traversability. Never remove the floor underneath the player; keep safe collision shells until a transition is complete.
- Cancellation releases obsolete requests/instances. Shared geometry/textures need reference-counted ownership before cache eviction; merely unmounting React does not prove GPU memory was released.
- Loading failures retain a navigable bounded fallback and retry option, not an invisible hole.

## First implementation boundary

Introduce explicit workspace, courtyard and pond descriptors and visual/collider separation. Reuse existing room/facade/tree assets. Demonstrate residency changes on a walk route before claiming large-world support. The prior renderer mounts its whole room/courtyard eagerly; distance-based frustum culling is not streaming.

Use instanced batches for repeated vegetation/architecture. Per-sector bounds permit frustum culling; choose LOD/density by quality and distance. Avoid thousands of React leaf/tree objects. Give animated vegetation conservative bounds so wind does not make it disappear.

Acceptance: deterministic residency tests, preload-before-entry, no collider gaps, safe failure, bounded live sector count, evidence that far resources downgrade/unload and that return visits preserve interactions. Status: architecture specified; actual streaming evidence must be recorded as it lands.
