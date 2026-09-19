# Offline Asset Pipeline

Blender is the asset factory, not the browser runtime. Keep sources outside the served directory, preserve originals and load third-party Blender files with automatic script execution disabled.

## Ingest -> deliver

1. Verify source/license and record author, source URL/identifier and source hash.
2. Inspect meshes, materials, embedded/external textures, rig and actual animation compatibility.
3. Normalize units/orientation and fit to the world. Preserve skin weights and animation bindings.
4. Produce separate visual assets, cheap collision proxies, named reusable modules and optional LODs. Bake static AO/light information where appropriate; retain dynamic character/sun behavior.
5. Cap texture dimensions by use. Keep correct color spaces, alpha cutouts and physical material channels.
6. Export self-contained GLB without cameras, preview floors or source-only objects. Record output hash, bytes, triangles, bones, clips and texture sizes.
7. Test reimport, runtime loading, pose/scale and loading failure. Source validity alone is insufficient.

Existing scripts under `apps/game/scripts/` already prepare environment maps, optimized trees, facades/furniture, Remy and Sergio. Extend these instead of reimplementing commodity converters.

## Compression experiment

Benchmark uncompressed GLB against Meshopt and, where appropriate, Draco. Measure transferred bytes, decode time, frame impact and visual difference on the same browser/device. Evaluate KTX2/Basis for GPU texture residency, and WebP/JPEG for transfer size. Configure and self-host required decoders/transcoders. Do not enable a codec solely because output bytes are smaller; decoding and compatibility matter. Preserve tangent/normal quality, skinning, morphs and clips.

## Delivery

Runtime assets currently live under `apps/game/public/assets/`, separate from the JavaScript bundle. Introduce versioned/hash-addressed asset URLs with cache policy before moving to object storage/CDN. Keep the registry provider-neutral; do not create a cloud bucket or incur charges without approval. Source blends, raw packs and render caches never belong in the shipped web directory.

The supplied Cognition image is a user-provided brand asset, not CC0. Derivatives must preserve the mark and be tracked separately from environment licenses. Do not invent an AI-generated replacement logo.

Status: resized/optimized local GLBs and provenance exist. Codec comparisons and baked-light production assets are not yet verified.
