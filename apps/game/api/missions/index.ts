// POST /api/missions (create). Vercel does not resolve the bare /api/missions path via the catch-all,
// so the create route needs its own file. Same proxy logic as [[...path]].ts.
export { config, default } from "./[[...path]]"
