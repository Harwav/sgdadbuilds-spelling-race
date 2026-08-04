import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createQualityState,
  profileFor,
  rememberedTier,
  rememberStableTier,
  sampleQuality,
} from './quality'

const WINDOW_MS = 4_000

function sampleWindow(state: ReturnType<typeof createQualityState>, fps: number) {
  let sampled = state
  const frames = fps * 4

  for (let frame = 1; frame <= frames; frame += 1) {
    sampled = sampleQuality(sampled, state.windowStartedAt + (WINDOW_MS * frame) / frames, true).state
  }

  return sampled
}

describe('quality governor', () => {
  beforeEach(() => {
    rememberStableTier('high')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps High through 60 FPS windows', () => {
    const state = sampleWindow(createQualityState(0), 60)

    expect(state).toMatchObject({ tier: 'high', consecutiveLowWindows: 0 })
  })

  it('keeps High after one 27 FPS window', () => {
    const state = sampleWindow(createQualityState(0), 27)

    expect(state).toMatchObject({ tier: 'high', consecutiveLowWindows: 1 })
  })

  it('steps from High to Balanced after a second consecutive 27 FPS window', () => {
    const firstWindow = sampleWindow(createQualityState(0), 27)
    const secondWindow = sampleWindow(firstWindow, 27)

    expect(secondWindow).toMatchObject({ tier: 'balanced', consecutiveLowWindows: 0 })
  })

  it('steps from Balanced to Safe after two more low-FPS windows', () => {
    const balanced = sampleWindow(sampleWindow(createQualityState(0), 27), 27)
    const safe = sampleWindow(sampleWindow(balanced, 27), 27)

    expect(safe).toMatchObject({ tier: 'safe', consecutiveLowWindows: 0 })
  })

  it('does not fall below Safe', () => {
    const safe = createQualityState(0, 'safe')
    const afterLowWindows = sampleWindow(sampleWindow(safe, 27), 27)

    expect(afterLowWindows.tier).toBe('safe')
  })

  it('resets a partial window when hidden', () => {
    const state = createQualityState(0)
    const partial = sampleQuality(state, 3_000, true).state
    const hidden = sampleQuality(partial, 3_100, false)
    const resumed = sampleQuality(hidden.state, 7_099, true)

    expect(hidden.state).toMatchObject({ windowStartedAt: 3_100, visibleFrames: 0, consecutiveLowWindows: 0 })
    expect(resumed).toMatchObject({ changed: false, state: { tier: 'high', visibleFrames: 1 } })
  })

  it('never upgrades after a later 60 FPS window', () => {
    const balanced = createQualityState(0, 'balanced')
    const afterSmoothWindow = sampleWindow(balanced, 60)

    expect(afterSmoothWindow).toMatchObject({ tier: 'balanced', consecutiveLowWindows: 0 })
  })

  it('uses the exact rendering profiles for every tier', () => {
    expect(profileFor('high')).toEqual({ dprCap: 1.5, shadowMapSize: 1024, distantDetail: true, particleScale: 1 })
    expect(profileFor('balanced')).toEqual({ dprCap: 1.25, shadowMapSize: 512, distantDetail: true, particleScale: 0.5 })
    expect(profileFor('safe')).toEqual({ dprCap: 1, shadowMapSize: 256, distantDetail: false, particleScale: 0.2 })
  })

  it('remembers a stable tier in replay memory without accessing browser storage', () => {
    const forbiddenStorage = new Proxy({}, {
      get: () => {
        throw new Error('browser storage must not be accessed')
      },
    })
    vi.stubGlobal('localStorage', forbiddenStorage)
    vi.stubGlobal('sessionStorage', forbiddenStorage)

    rememberStableTier('balanced')

    expect(rememberedTier()).toBe('balanced')
    expect(createQualityState(0).tier).toBe('balanced')
  })
})
