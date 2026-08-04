import { describe, expect, it } from 'vitest'
import { createQualityState, sampleQuality, type QualityState } from './quality'
import {
  createActiveFrameTrace,
  listenForVisibilityTransitions,
  resetRendererSampling,
} from './rendererSession'

describe('renderer session lifecycle', () => {
  it('records only active visible race frames and preserves the trace across gaps', () => {
    const trace = createActiveFrameTrace()

    trace.recordFrame(0, { paused: true, visible: true })
    trace.recordFrame(1_000, { paused: false, visible: false })
    expect(trace.started).toBe(false)
    expect(trace.frameTimesMs).toEqual([])

    trace.recordFrame(2_000, { paused: false, visible: true })
    trace.recordFrame(2_016, { paused: false, visible: true })
    trace.recordFrame(2_032, { paused: true, visible: true })
    trace.recordFrame(4_032, { paused: false, visible: true })
    trace.recordFrame(4_048, { paused: false, visible: true })
    trace.recordFrame(4_064, { paused: false, visible: false })
    trace.recordFrame(7_064, { paused: false, visible: true })
    trace.recordFrame(7_080, { paused: false, visible: true })

    expect(trace.started).toBe(true)
    expect(trace.frameTimesMs).toEqual([16, 16, 16])
  })

  it('retains the complete race trace in one stable array', () => {
    const trace = createActiveFrameTrace()
    const frameTimes = trace.frameTimesMs

    trace.recordFrame(0, { paused: false, visible: true })
    for (let frame = 1; frame <= 700; frame += 1) {
      trace.recordFrame(frame * 16, { paused: false, visible: true })
    }

    expect(trace.frameTimesMs).toBe(frameTimes)
    expect(frameTimes).toHaveLength(700)
    expect(frameTimes[0]).toBe(16)
    expect(frameTimes.at(-1)).toBe(16)
  })

  it('resets quality and frame baselines on visibility transitions and removes its listener', () => {
    const source = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState }
    let visibilityState: DocumentVisibilityState = 'visible'
    Object.defineProperty(source, 'visibilityState', { get: () => visibilityState })
    const trace = createActiveFrameTrace()
    let now = 1_016
    let quality: QualityState = createQualityState(0, 'high')
    quality = sampleQuality(quality, 1_000, true).state
    trace.recordFrame(1_000, { paused: false, visible: true })
    trace.recordFrame(1_016, { paused: false, visible: true })

    const stop = listenForVisibilityTransitions(source, () => {
      quality = resetRendererSampling(quality, now, trace)
    })
    visibilityState = 'hidden'
    source.dispatchEvent(new Event('visibilitychange'))

    expect(quality).toMatchObject({ windowStartedAt: 1_016, visibleFrames: 0, consecutiveLowWindows: 0 })

    now = 20_000
    visibilityState = 'visible'
    source.dispatchEvent(new Event('visibilitychange'))
    trace.recordFrame(20_000, { paused: false, visible: true })
    trace.recordFrame(20_016, { paused: false, visible: true })

    expect(quality.windowStartedAt).toBe(20_000)
    expect(trace.frameTimesMs).toEqual([16, 16])

    stop()
    now = 30_000
    visibilityState = 'hidden'
    source.dispatchEvent(new Event('visibilitychange'))
    expect(quality.windowStartedAt).toBe(20_000)
  })
})
