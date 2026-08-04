import { describe, expect, it } from 'vitest'

import { createVoiceDiagnosticRecorder, type VoiceDiagnosticPayload } from './voiceDiagnostics'

describe('createVoiceDiagnosticRecorder', () => {
  it('records lifecycle timing without accepting speech content', () => {
    const events: VoiceDiagnosticPayload[] = []
    let now = 1_000
    const recorder = createVoiceDiagnosticRecorder(true, (payload) => events.push(payload), () => now)

    recorder.begin(4)
    now = 1_180
    recorder.record('listening', 4)
    now = 1_925
    recorder.record('result', 4, { final: false, actionable: true })
    now = 2_050
    recorder.record('ended', 4, { restart: true })

    expect(events).toEqual([
      { stage: 'requested', attempt: 4, elapsed_ms: 0 },
      { stage: 'listening', attempt: 4, elapsed_ms: 180 },
      { stage: 'result', attempt: 4, elapsed_ms: 925, final: false, actionable: true },
      { stage: 'ended', attempt: 4, elapsed_ms: 1050, restart: true },
    ])
    expect(JSON.stringify(events)).not.toContain('transcript')
    expect(JSON.stringify(events)).not.toContain('candidate')
  })

  it('does nothing outside debug mode', () => {
    const events: VoiceDiagnosticPayload[] = []
    const recorder = createVoiceDiagnosticRecorder(false, (payload) => events.push(payload), () => 1_000)

    recorder.begin(1)
    recorder.record('listening', 1)

    expect(events).toEqual([])
  })
})
