export type QualityTier = 'high' | 'balanced' | 'safe'

export type QualityProfile = {
  readonly dprCap: 1.5 | 1.25 | 1
  readonly shadowMapSize: 1024 | 512 | 256
  readonly distantDetail: boolean
  readonly particleScale: 1 | 0.5 | 0.2
}

export type QualityState = {
  readonly tier: QualityTier
  readonly windowStartedAt: number
  readonly visibleFrames: number
  readonly consecutiveLowWindows: number
}

const WINDOW_MS = 4_000
const LOW_FPS = 28
const LOW_WINDOWS_TO_STEP = 2
const ORDER: readonly QualityTier[] = ['high', 'balanced', 'safe']
const nextTier = (tier: QualityTier) => ORDER[Math.min(ORDER.indexOf(tier) + 1, ORDER.length - 1)]

let stableTier: QualityTier = 'high'

export function createQualityState(now: number, initial = stableTier): QualityState {
  return {
    tier: initial,
    windowStartedAt: now,
    visibleFrames: 0,
    consecutiveLowWindows: 0,
  }
}

export function sampleQuality(state: QualityState, now: number, visible: boolean): { state: QualityState; changed: boolean } {
  if (!visible) {
    return {
      state: {
        ...state,
        windowStartedAt: now,
        visibleFrames: 0,
        consecutiveLowWindows: 0,
      },
      changed: false,
    }
  }

  const visibleFrames = state.visibleFrames + 1
  const elapsed = now - state.windowStartedAt
  if (elapsed < WINDOW_MS) {
    return { state: { ...state, visibleFrames }, changed: false }
  }

  const lowFps = visibleFrames / (elapsed / 1_000) < LOW_FPS
  const consecutiveLowWindows = lowFps ? state.consecutiveLowWindows + 1 : 0
  const tier = consecutiveLowWindows >= LOW_WINDOWS_TO_STEP ? nextTier(state.tier) : state.tier

  return {
    state: {
      tier,
      windowStartedAt: now,
      visibleFrames: 0,
      consecutiveLowWindows: tier === state.tier ? consecutiveLowWindows : 0,
    },
    changed: tier !== state.tier,
  }
}

export function profileFor(tier: QualityTier): QualityProfile {
  if (tier === 'high') return { dprCap: 1.5, shadowMapSize: 1024, distantDetail: true, particleScale: 1 }
  if (tier === 'balanced') return { dprCap: 1.25, shadowMapSize: 512, distantDetail: true, particleScale: 0.5 }
  return { dprCap: 1, shadowMapSize: 256, distantDetail: false, particleScale: 0.2 }
}

export function rememberStableTier(tier: QualityTier): void {
  stableTier = tier
}

export function rememberedTier(): QualityTier {
  return stableTier
}
