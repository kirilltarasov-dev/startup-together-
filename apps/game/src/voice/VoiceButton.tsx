// <VoiceButton/> — self-contained Talk / Mute / Disconnect control + live caption.
// Mounted by Lane A in EventCard's voiceSlot. Never blocks the choice buttons.

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { getVoiceContext, subscribeVoiceContext } from '../state/voiceBridge'
import type { VoiceState } from './liveClient'
import { getLiveClient } from './voiceSession'

function MicIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

const ICON_BTN = 'inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors'

export default function VoiceButton() {
  // Shared session: survives unmount/remount across screens. Disconnect is explicit (button, restart, caps).
  const client = getLiveClient()
  const [s, setS] = useState<VoiceState>(() => client.getState())
  const [hasCtx, setHasCtx] = useState(() => getVoiceContext() !== null)

  useEffect(() => client.subscribe(setS), [client])
  useEffect(() => subscribeVoiceContext((ctx) => setHasCtx(ctx !== null)), [])

  const connected = s.status === 'listening' || s.status === 'speaking'

  return (
    <div className="flex flex-col items-end gap-1 max-w-[260px] text-right select-none" aria-live="polite">
      <div className="flex items-center gap-2">
        {s.status === 'idle' && (
          <button
            type="button"
            disabled={!hasCtx}
            title={hasCtx ? 'Talk to your cofounders' : 'No voice moment right now'}
            aria-label="Talk"
            onClick={() => { void client.connect() }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 px-3 py-1.5 text-xs font-bold tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors"
          >
            <MicIcon /> Talk
          </button>
        )}

        {s.status === 'connecting' && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs tracking-widest uppercase opacity-70">
            <motion.span
              className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              aria-hidden="true"
            />
            Connecting
          </span>
        )}

        {connected && (
          <>
            <span className="relative inline-flex items-center justify-center w-7 h-7" aria-label={s.status === 'speaking' ? 'Speaking' : 'Listening'}>
              {!s.muted && (
                <motion.span
                  className={`absolute inset-0 rounded-full ${s.status === 'speaking' ? 'bg-[#FF5A5F]/40' : 'bg-emerald-400/40'}`}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ repeat: Infinity, duration: s.status === 'speaking' ? 0.9 : 1.6, ease: 'easeInOut' }}
                  aria-hidden="true"
                />
              )}
              <span className={`relative inline-flex items-center justify-center w-7 h-7 rounded-full ${s.status === 'speaking' ? 'bg-[#FF5A5F] text-white' : s.muted ? 'bg-white/10 text-white/50' : 'bg-emerald-500 text-black'}`}>
                {s.muted ? <MutedIcon /> : <MicIcon />}
              </span>
            </span>
            <button
              type="button"
              onClick={() => client.setMuted(!s.muted)}
              aria-label={s.muted ? 'Unmute microphone' : 'Mute microphone'}
              aria-pressed={s.muted}
              title={s.muted ? 'Unmute' : 'Mute'}
              className={ICON_BTN}
            >
              {s.muted ? <MutedIcon /> : <MicIcon />}
            </button>
            <button
              type="button"
              onClick={() => client.disconnect()}
              aria-label="Disconnect voice"
              title="Disconnect"
              className={`${ICON_BTN} hover:border-[#FF5A5F]/60 hover:text-[#FF5A5F]`}
            >
              <CloseIcon />
            </button>
          </>
        )}

        {s.status === 'unavailable' && (
          <button
            type="button"
            onClick={() => { void client.connect() }}
            title="Retry"
            aria-label={`Voice unavailable: ${s.reason ?? 'unknown'}. Retry`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A5F]/40 bg-[#FF5A5F]/10 px-3 py-1.5 text-[10px] tracking-widest uppercase text-[#FF5A5F] hover:bg-[#FF5A5F]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/60"
          >
            <MutedIcon /> Voice unavailable{s.reason ? ` — ${s.reason}` : ''}
          </button>
        )}
      </div>

      {connected && s.heard && (
        <div className="text-[11px] leading-snug opacity-40 italic truncate w-full" title={s.heard}>you: {s.heard}</div>
      )}
      {connected && s.caption && (
        <div className="text-xs leading-snug opacity-80 line-clamp-3 w-full">{s.caption}</div>
      )}
      {connected && !s.caption && !s.heard && (
        <div className="text-[10px] tracking-widest uppercase opacity-40">{s.muted ? 'muted' : 'listening…'}</div>
      )}
    </div>
  )
}
