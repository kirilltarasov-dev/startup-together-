/**
 * Sound effects via react-sounds (howler). Self-hosted under public/sounds so the demo never depends on a CDN.
 * Everything respects the HUD mute toggle (runStore.muted).
 */
import { playSound, setCDNUrl, setSoundEnabled } from 'react-sounds'
import { useRun } from './runStore'

setCDNUrl('/sounds')

export const SFX = {
  click: 'ui/button_medium',
  select: 'ui/item_select',
  cash: 'arcade/coin',
  alarm: 'notification/warning',
  incident: 'ui/buzz_long',
  deploy: 'system/boot_up',
  win: 'arcade/level_up',
  lose: 'arcade/level_down',
  door: 'game/portal_opening',
  chime: 'ui/success_chime',
  error: 'notification/error',
  type: 'ui/keystroke_soft',
} as const

export type SfxName = keyof typeof SFX

export function sfx(name: SfxName, volume = 0.6) {
  if (useRun.getState().muted) return
  playSound(SFX[name], { volume }).catch(() => {})
}

useRun.subscribe((s) => setSoundEnabled(!s.muted))
