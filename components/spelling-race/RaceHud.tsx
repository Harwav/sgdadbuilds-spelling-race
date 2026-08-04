'use client'

import type { RacePlacement } from '@/lib/spelling-race/types'

type RaceHudProps = {
  placement: RacePlacement
  lap: number
  microphone: 'ready' | 'listening' | 'interrupted'
  muted: boolean
  paused: boolean
  onMute(): void
  onPause(): void
  onExit(): void
}

export default function RaceHud({ placement, lap, microphone, muted, paused, onMute, onPause, onExit }: RaceHudProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-3 text-sm">
      <div data-testid="race-hud-left" className="rounded-xl border px-3 py-2 shadow-lg" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
        <p className="text-lg font-bold">{ordinal(placement)}</p>
        <p className="font-semibold">Lap {lap} / 3</p>
      </div>

      <div data-testid="race-hud-right" className="pointer-events-auto flex flex-col items-end gap-1">
        <div className="rounded-full border px-2 py-2 text-center text-xs shadow-lg" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
          <span aria-live="polite" className="font-semibold">Mic: {microphone}</span>
        </div>
        <button type="button" aria-label={muted ? 'Sound on' : 'Mute'} title={muted ? 'Sound on' : 'Mute'} onClick={onMute} className="grid min-h-11 min-w-11 place-items-center rounded-full border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-strong)' }}>
          <SoundIcon muted={muted} />
        </button>
        <button type="button" aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'} onClick={onPause} className="grid min-h-11 min-w-11 place-items-center rounded-full border" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-strong)' }}>
          <PauseIcon paused={paused} />
        </button>
        <button type="button" onClick={onExit} className="min-h-11 rounded-full border px-4 font-semibold" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>Parent exit</button>
      </div>
    </div>
  )
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15 9.5a4 4 0 0 1 0 5m3-8a8 8 0 0 1 0 11" />}
    </svg>
  )
}

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      {paused ? <path d="m8 5 11 7-11 7Z" /> : <path d="M7 5h4v14H7zm6 0h4v14h-4z" />}
    </svg>
  )
}

function ordinal(placement: RacePlacement): string {
  return placement === 1 ? '1st' : placement === 2 ? '2nd' : placement === 3 ? '3rd' : '4th'
}
