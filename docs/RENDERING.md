# Rendering Plan

## Stable baseline

Use the installed Three.js/R3F WebGL renderer, ACES tone mapping and authored PBR materials. One directional sun, a coherent sky/fog palette, bounded shadow coverage around the player, HDR image-based lighting and motivated local room lights form one system. Time-of-day parameters should jointly control sun direction/intensity, sky, fog, exposure and local-light activation; a day/night-capable interface is not proof of finished night art.

Keep base color/emissive maps in sRGB and normal/roughness/metallic/AO maps in linear data space. Preserve character skin, eyes and hair cutouts. Do not use diffuse textures as a substitute for real normal maps where PBR sources exist. Reduce repeated patterns through real-world UV scale and authored detail, not a large ambient-light wash.

## Post-processing admission

Start from antialiased clean rendering. Compare a fixed-camera screenshot and frame-time sample before enabling SSAO/contact enhancement or bloom. Keep vignette/color grading restrained. Depth-of-field belongs to explicit cinematic moments, never constant locomotion blur. God rays require a motivated visible light source and a demonstrated benefit. Installed post-processing packages are not evidence that effects are active.

## WaterSurface contract

World code provides bounds, water level, normal-map source, sun direction/color, wind/time and a quality descriptor. A WebGL implementation should reuse Three.js Water/Water2 reflection/refraction helpers where suitable. Expose reflection resolution and update rate separately from normal movement. Model the shoreline/basin and prevent the player falling through an unimplemented water volume. Avoid a blue opaque plane labelled as a lake. Dispose per-surface reflection targets while retaining shared textures.

## Renderer evolution

Create a separate `spike/webgpu` branch or isolated worktree for WebGPURenderer/TSL trials. Compare the same camera route, assets, resolution and device, recording visual differences and frame times. Candidate uses: vegetation compute, particles and water. WebGL remains available on unsupported devices. No production promotion based only on WebGPU availability.

Status: prior release has PBR/HDR/shadows/fog; water, complete time-of-day behavior, post-processing comparisons and WebGPU benchmarks remain acceptance work.
