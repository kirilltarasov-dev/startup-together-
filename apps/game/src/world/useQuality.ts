import { useSyncExternalStore } from 'react'
import { getQuality, getQualityState, subscribeQuality, type QualitySettings } from './quality'

/** Current tier settings; re-renders on manual or automatic changes (world/quality.ts store). */
export function useQuality(): QualitySettings {
  useSyncExternalStore(subscribeQuality, getQualityState, getQualityState)
  return getQuality()
}
