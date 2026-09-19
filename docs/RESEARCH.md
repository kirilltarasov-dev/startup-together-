# Skills and Accelerators

Checked September 19, 2026. Recommendations are for this three-hour project,
not a general-purpose game-development toolchain.

Early web searches returned no usable page content; publisher GitHub APIs and
direct documentation retrieval supplied the primary evidence. Devin's official
API overview was also retrieved through web browsing. Source code on a default
branch may differ from published packages; T01 must check actual compatibility.

The first recommendations preceded `RUNWAY.md`. The received brief supersedes
the no-backend assumption and changes skill priorities toward real integration,
verification, and safe execution.

## Agent Skill Shortlist

Skills guide an agent's workflow; they are not game engines or extra teammates
[S11]. No new skills have been installed in this task.

Local filesystem inventory checked September 19, 2026. Relevant existing skills:
`execution-skill`, `frontend-skill`, `github-enterprise-publish`, `openai-docs`,
and `imagegen`. The first four have been consulted during this project;
`imagegen` is available but has not generated assets for it.

There are no repository `SKILL.md` files and no skills vendored for teammates.
Their Devin installations are separate; this window has not configured them.
`AGENTS.md` and the coordination documents are the portable project instructions.

| Skill | Availability and scope | Recommendation |
| --- | --- | --- |
| `execution-skill` | Already available locally; minimal changes and verification | Use for implementation after Gate 0 |
| `frontend-skill` | Already available locally; visual hierarchy and usable interfaces | Apply its game/app guidance, not its landing-page composition |
| `github-enterprise-publish` | Already available locally; safe Git and publishing checks | Use exact host `github.com`, explicit publishing requests, and `Big-Boss-0` here |
| `openai-docs` | Already available locally; consulted for the voice API documentation | Use official API guidance |
| `imagegen` | Already available locally; not used for this project | Optional bitmap art only if it saves asset-production time |
| OpenAI `playwright` | In the official curated catalog; terminal-driven real-browser interaction [S10] | Highest-priority optional installation for visual QA; not installed |
| OpenAI `security-best-practices` | Official curated skill; reviewed its instructions and available Python/FastAPI and React reference entries [S21] | Useful for the secret/cost/runner boundary review; not installed or a substitute for isolation |
| Vercel React Best Practices | Publisher skill with React/Next.js performance rules [S12] | Optional reference for React rendering; Next.js/server rules do not justify adding Next.js |
| CloudAI-X Three.js skills | Community bundle; inspected README, directory list, and fundamentals skill [S13] | Reference only; not verified as a drop-in R3F workflow |

The community bundle's README includes setup instructions pointing to
`pinkforest/threejs-playground`, while the inspected repository is
`CloudAI-X/threejs-skills`. Its fundamentals example creates a renderer and its
own animation loop. Those patterns should not be pasted into an R3F application,
where renderer lifecycle belongs to Fiber. This is a concrete reason to prefer
the maintainers' R3F guidance over installing the whole bundle blindly.

If a skill is requested later: inspect its instructions and bundled scripts,
verify its license and source, pin a reviewed revision, install only the needed
skill, and record the revision here. Do not add a plugin marketplace or extra MCP
service solely to obtain planning discipline.

## Ready-Made Accelerators

| Tool / approach | What it can save | Decision and fallback |
| --- | --- | --- |
| Vite React/TypeScript template [S1] | Build configuration and app shell | Already supplied in `apps/game/`; reuse it |
| Drei [S3] | Common R3F camera, loading, and scene helpers | Use selected helpers instead of custom equivalents |
| Rapier wrapper [S5] | Physics and collision implementation | Evaluated; excluded from this management-game slice |
| Ecctrl [S6] | Character-controller implementation | Evaluated; excluded because founders do not need locomotion |
| Kenney assets [S7] | Modelling and coherent environment/prop art | Pick one relevant pack after the script; inspect its included license |
| GLTFJSX [S9] | Typed React components from GLTF and optional asset transforms | Use only if model manipulation needs it; direct loading is simpler otherwise |
| Vercel/Railway hosting direction | Public playable game and services | Latest user direction in `HANDOFF.md`; protected paid operations |
| Devin v3 API [S15-S17] | Session creation, structured results, status, and cost cap | Use after account/permissions are confirmed; do not rely on old v1 snippets |
| Devin environment setup [S19] | Repeatable dependency-ready mission workspace | Evaluate existing setup first; do not create a new platform |
| Small FastAPI orchestrator [S20] | Familiar API foundation matching source stack | One bounded mission; no broker; heavy verification outside API process |
| Fixed camera and reusable set assets | Camera/controller work and content production | Three distinct scenes under the approved scope |
| Pre-authored story beats | Runtime story-generation latency and integration risk | Narrative is authored; the engineering mission is still real |

The teammate already provided the Vite starter and target Python repository.
Reuse those accelerators; do not scaffold a competing application. Zustand,
Tailwind, and Framer Motion are already declared in `apps/game/package.json`.

## Integration Findings

- Devin's current official overview uses the v3 organization API. Authentication
  and repository authorization are separate from this window's GitHub login [S15-S18].
- Creation and retrieval require different permissions; create responses and
  get responses must be normalized instead of assuming legacy status values [S16-S17].
- Repository instructions, including `AGENTS.md`, are useful guidance, not a
  replacement for enforced access restrictions and isolated candidate execution.
- Existing starter observations and the exact trust boundary are documented in
  `DEVIN_CONTRACT.md`. None of the illustrative benchmark results is verified.

Kenney's publisher support page states that assets on its asset pages use CC0
[S7]. This does not establish hackathon eligibility; check organizer rules and
the selected pack's license file before importing it.

Poly Haven was considered, but its license page returned HTTP 403 during this
check. Its assets are not approved or required by this plan.

## What We Are Deliberately Avoiding

- A large backend: only orchestration and trusted verification are justified.
- Switching to a large starter kit with unknown dependencies and auth assumptions.
- Custom physics, character rigs, shader pipelines, or a new world editor.
- Mandatory paid tools or account setup before a playable proof.
- Large skill bundles that duplicate instructions or conflict with R3F ownership.
- Spending the whole hackathon planning. The greybox target is 12:59 CEST in `PLAN.md`.

## Asset Register

Nothing has been downloaded or approved yet.

| Local path | Source/creator | License evidence | Size/transformation | Hackathon eligibility | Status |
| --- | --- | --- | --- | --- | --- |
| None | Awaiting art-direction approval and pack selection | Not checked | - | Not checked | NOT SELECTED |

## Primary Sources

Source IDs are referenced in `ARCHITECTURE.md`. URLs identify the publisher pages
or files actually consulted; they are not installation commands.

| ID | Publisher source |
| --- | --- |
| S1 | Vite getting started: `https://github.com/vitejs/vite/blob/main/docs/guide/index.md` |
| S2 | R3F introduction and React pairing: `https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/introduction.mdx` |
| S3 | Drei README: `https://github.com/pmndrs/drei` |
| S4 | R3F performance pitfalls: `https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/pitfalls.mdx` |
| S5 | React Three Rapier README: `https://github.com/pmndrs/react-three-rapier` |
| S6 | Ecctrl README: `https://github.com/pmndrs/ecctrl` |
| S7 | Kenney publisher support and asset licensing statement: `https://kenney.nl/support` |
| S8 | Vite static deployment guide: `https://github.com/vitejs/vite/blob/main/docs/guide/static-deploy.md` |
| S9 | GLTFJSX README: `https://github.com/pmndrs/gltfjsx` |
| S10 | OpenAI Playwright skill: `https://github.com/openai/skills/blob/main/skills/.curated/playwright/SKILL.md` |
| S11 | OpenAI skill documentation: `https://developers.openai.com/codex/skills/` |
| S12 | Vercel publisher skill: `https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md` |
| S13 | Community Three.js bundle: `https://github.com/CloudAI-X/threejs-skills` |
| S14 | OpenAI curated skill catalog: `https://github.com/openai/skills/tree/main/skills/.curated` |
| S15 | Devin API overview and authentication: `https://docs.devin.ai/api-reference/overview.md` and `https://docs.devin.ai/api-reference/authentication.md` |
| S16 | Devin create session: `https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions.md` |
| S17 | Devin get session: `https://docs.devin.ai/api-reference/v3/sessions/get-organizations-session.md` |
| S18 | Devin Git integration and permissions: `https://docs.devin.ai/enterprise/integrations/git-integrations.md` |
| S19 | Devin repository/environment and task preparation: `https://docs.devin.ai/llms.txt` and `https://docs.devin.ai/essential-guidelines/instructing-devin-effectively.md` |
| S20 | FastAPI background-task limitations: `https://github.com/fastapi/fastapi/blob/master/docs/en/docs/tutorial/background-tasks.md` |
| S21 | Official security skill: `https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md` |
| S22 | Devin security profiles and their enforcement boundaries: `https://docs.devin.ai/product-guides/security-profiles.md` |

## Research Boundary

Framework capability and candidate tools are verified at the level described
above. The adapted design, selected asset pack, Devin/hosting permissions,
published new dependencies, actual performance, and hackathon compliance remain
unapproved or unverified. Roles/storyboard are our creative recommendations,
not claims that a downloaded skill will perform those jobs autonomously.
