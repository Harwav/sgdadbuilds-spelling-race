import { describe, expect, it } from 'vitest'
import { createRaceGantry, validateRaceGantry } from '@/components/spelling-race/world/gantry'
import { createTrackEnvelope } from './trackEnvelope'
import { SINGAPORE_HEARTLAND_ROUTE } from './routes'

describe('race gantry', () => {
  it('provides semantic display and footing anchors', () => {
    const gantry = createRaceGantry(createTrackEnvelope(SINGAPORE_HEARTLAND_ROUTE))

    expect(validateRaceGantry(gantry)).toEqual([])
    expect(gantry.getObjectByName('display_top_left')).toBeDefined()
    expect(gantry.getObjectByName('display_bottom_right')).toBeDefined()
    expect(gantry.getObjectByName('pylon_left_foot')).toBeDefined()
    expect(gantry.getObjectByName('signal-listening')).toBeDefined()
  })
})
