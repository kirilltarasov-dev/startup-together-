// GPT Live owns microphone input. A second browser recognizer hears scripted
// output and bypasses the Live mute/floor policy. Keep existing callers inert.
export function initCommandEar(): () => void { return () => {} }
export function isCommandEarActive(): boolean { return false }
export function handleHeard(_raw: string): void {}
