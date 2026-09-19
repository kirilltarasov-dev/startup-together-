// Module-level singleton so the GPT-Live session survives screen changes
// (play -> devin -> play -> ending). Closed only by explicit Disconnect, restart, or the caps.

import { createLiveClient, type LiveClient } from './liveClient'

let client: LiveClient | null = null

export function getLiveClient(): LiveClient {
  return (client ??= createLiveClient())
}
