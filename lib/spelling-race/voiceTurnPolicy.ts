import type { SightWordAttemptMode } from './transcriptMatcher'

export type VoiceEvidence = 'accepted' | 'unresolved'

export type VoiceTurnDecision =
  | { kind: 'accept' }
  | { kind: 'prompt-retry' }
  | { kind: 'defer' }
  | { kind: 'block'; code: string }

export function decideVoiceEvidence(
  mode: SightWordAttemptMode,
  evidence: VoiceEvidence,
): VoiceTurnDecision {
  if (evidence === 'accepted') return { kind: 'accept' }
  return mode === 'isolated' ? { kind: 'prompt-retry' } : { kind: 'defer' }
}

export function decideVoiceError(mode: SightWordAttemptMode, code: string): VoiceTurnDecision {
  if (code === 'not-allowed' || code === 'service-not-allowed') return { kind: 'block', code }
  return mode === 'isolated' ? { kind: 'prompt-retry' } : { kind: 'defer' }
}
