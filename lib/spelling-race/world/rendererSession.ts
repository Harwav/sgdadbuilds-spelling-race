import { sampleQuality, type QualityState } from './quality'

export type ActiveFrameTrace = {
  readonly started: boolean
  readonly frameTimesMs: readonly number[]
  recordFrame(now: number, state: { readonly paused: boolean; readonly visible: boolean }): void
  resetBaseline(): void
}

type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: EventListener): void
  removeEventListener(type: 'visibilitychange', listener: EventListener): void
}

export function createActiveFrameTrace(): ActiveFrameTrace {
  const frameTimesMs: number[] = []
  let started = false
  let baseline: number | null = null

  return {
    get started() {
      return started
    },
    frameTimesMs,
    recordFrame(now, { paused, visible }) {
      const active = !paused && visible
      if (!active) {
        baseline = null
        return
      }
      if (!started) {
        frameTimesMs.length = 0
        started = true
      }
      if (baseline !== null) {
        const frameTimeMs = now - baseline
        if (Number.isFinite(frameTimeMs) && frameTimeMs > 0) frameTimesMs.push(frameTimeMs)
      }
      baseline = now
    },
    resetBaseline() {
      baseline = null
    },
  }
}

export function resetRendererSampling(
  qualityState: QualityState,
  now: number,
  frameTrace: ActiveFrameTrace,
): QualityState {
  frameTrace.resetBaseline()
  return sampleQuality(qualityState, now, false).state
}

export function listenForVisibilityTransitions(
  source: VisibilitySource,
  onTransition: (visibilityState: DocumentVisibilityState) => void,
): () => void {
  const handleVisibilityChange: EventListener = () => onTransition(source.visibilityState)
  source.addEventListener('visibilitychange', handleVisibilityChange)
  return () => source.removeEventListener('visibilitychange', handleVisibilityChange)
}
