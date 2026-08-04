export type VoiceDiagnosticStage = 'requested' | 'listening' | 'result' | 'error' | 'ended' | 'restart'

export type VoiceDiagnosticPayload = {
  stage: VoiceDiagnosticStage
  attempt: number
  elapsed_ms: number
  final?: boolean
  actionable?: boolean
  restart?: boolean
  error?: string
}

type VoiceDiagnosticDetails = Pick<VoiceDiagnosticPayload, 'final' | 'actionable' | 'restart' | 'error'>

export function createVoiceDiagnosticRecorder(
  enabled: boolean,
  emit: (payload: VoiceDiagnosticPayload) => void,
  now: () => number = () => performance.now(),
) {
  let startedAt = 0

  return {
    begin(attempt: number) {
      if (!enabled) return
      startedAt = now()
      emit({ stage: 'requested', attempt, elapsed_ms: 0 })
    },
    record(stage: Exclude<VoiceDiagnosticStage, 'requested'>, attempt: number, details: VoiceDiagnosticDetails = {}) {
      if (!enabled) return
      emit({ stage, attempt, elapsed_ms: Math.round(now() - startedAt), ...details })
    },
  }
}
