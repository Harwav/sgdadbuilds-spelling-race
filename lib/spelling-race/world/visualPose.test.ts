import { describe, expect, it } from 'vitest'
import { resolveVisualKartPoses } from './visualPose'

describe('visual kart poses', () => {
  it('separates coincident karts without sending either outside legal lanes', () => {
    const poses = resolveVisualKartPoses([
      { id: 'player', progress: 0.5, lateral: 0 },
      { id: 'rival-a', progress: 0.5, lateral: 0 },
      { id: 'rival-b', progress: 0.5, lateral: 0 },
    ], { minProgressGap: 0.018, lateralBounds: [-0.8, 0.8] })

    expect(new Set(poses.map((pose) => pose.progress)).size).toBe(3)
    expect(poses.every((pose) => pose.lateral >= -0.8 && pose.lateral <= 0.8)).toBe(true)
  })

  it('preserves numeric rival identifiers for renderer lookup', () => {
    const poses = resolveVisualKartPoses([{ id: 7, progress: 0.5, lateral: 0 }], {
      minProgressGap: 0.018,
      lateralBounds: [-0.8, 0.8],
    })

    expect(poses[0].id).toBe(7)
  })
})
