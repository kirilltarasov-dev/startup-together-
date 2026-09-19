import { useFrame } from '@react-three/fiber'
import { useState } from 'react'
import { QUALITY_ORDER, QualityAutoTuner, getQualityState, setQuality, type Quality } from './quality'
import { useQuality } from './useQuality'

const LABEL: Record<Quality, string> = { high: 'High', balanced: 'Balanced', low: 'Low' }

/** Compact toolbar control, styled like the Character select in the third-person header. */
export function QualitySelect({ className = '' }: { className?: string }) {
  const { tier } = useQuality()
  return <label className={`rounded border border-line bg-panel p-2 text-xs ${className}`}>Quality <select aria-label="Render quality" value={tier} onChange={(event) => setQuality(event.target.value as Quality, 'manual')} className="bg-panel text-mint">
    {[...QUALITY_ORDER].reverse().map((item) => <option key={item} value={item}>{LABEL[item]}</option>)}
  </select></label>
}

/**
 * Mount inside the Canvas: samples the render loop's frame time for the auto tuner and mirrors the tier plus the
 * renderer's actual dpr/shadow state onto the canvas dataset (`data-quality*`) for browser evidence.
 */
export function QualityBridge() {
  const [tuner] = useState(() => new QualityAutoTuner(getQualityState, (tier) => setQuality(tier, 'auto')))
  useFrame((state, delta) => {
    const before = tuner.windows
    tuner.sample(delta * 1000, performance.now())
    const data = state.gl.domElement.dataset
    const { tier, manual } = getQualityState()
    if (data.quality !== tier) data.quality = tier
    const manualFlag = String(manual)
    if (data.qualityManual !== manualFlag) data.qualityManual = manualFlag
    if (tuner.windows !== before) { data.qualityP50 = tuner.lastP50.toFixed(1); data.qualityWindows = String(tuner.windows); data.qualityAuto = tuner.lastChange }
    // R3F applies the Canvas dpr/shadows props in its own effect, so read the renderer live rather than the table.
    const dpr = state.gl.getPixelRatio().toFixed(2)
    if (data.qualityDpr !== dpr) data.qualityDpr = dpr
    const shadows = String(state.gl.shadowMap.enabled)
    if (data.qualityShadows !== shadows) data.qualityShadows = shadows
  })
  return null
}
