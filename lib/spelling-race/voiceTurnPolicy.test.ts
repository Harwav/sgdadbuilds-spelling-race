import { describe, expect, it } from 'vitest'
import { decideVoiceError, decideVoiceEvidence } from './voiceTurnPolicy'

describe('voice turn policy', () => {
  it('accepts strong evidence on either attempt', () => {
    expect(decideVoiceEvidence('isolated', 'accepted')).toEqual({ kind: 'accept' })
    expect(decideVoiceEvidence('carrier', 'accepted')).toEqual({ kind: 'accept' })
  })

  it('prompts once, then defers unresolved evidence', () => {
    expect(decideVoiceEvidence('isolated', 'unresolved')).toEqual({ kind: 'prompt-retry' })
    expect(decideVoiceEvidence('carrier', 'unresolved')).toEqual({ kind: 'defer' })
  })

  it('blocks only permission failures', () => {
    for (const code of ['not-allowed', 'service-not-allowed']) {
      expect(decideVoiceError('isolated', code)).toEqual({ kind: 'block', code })
    }
  })

  it('treats recognition failures as bounded unresolved attempts', () => {
    for (const code of ['no-speech', 'aborted', 'network', 'start-failed']) {
      expect(decideVoiceError('isolated', code)).toEqual({ kind: 'prompt-retry' })
      expect(decideVoiceError('carrier', code)).toEqual({ kind: 'defer' })
    }
  })
})
