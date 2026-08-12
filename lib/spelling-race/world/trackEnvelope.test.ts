import { describe, expect, it } from 'vitest'
import { createTrackEnvelope, validateLandmarkClearance } from './trackEnvelope'
import { SINGAPORE_HEARTLAND_ROUTE } from './routes'

describe('track envelope', () => {
  it('keeps every safety band outside the driveable asphalt', () => {
    const envelope = createTrackEnvelope(SINGAPORE_HEARTLAND_ROUTE)

    expect(envelope.tokens.asphaltHalfWidth).toBeLessThan(envelope.tokens.kerbInnerOffset)
    expect(envelope.tokens.kerbInnerOffset).toBeLessThan(envelope.tokens.kerbOuterOffset)
    expect(envelope.tokens.kerbOuterOffset).toBeLessThan(envelope.tokens.runoffOuterOffset)
    expect(envelope.tokens.runoffOuterOffset).toBeLessThan(envelope.tokens.barrierInnerOffset)
    expect(envelope.tokens.barrierInnerOffset).toBeLessThan(envelope.tokens.sceneryClearanceOffset)
  })

  it('returns a crowned asphalt sample with legal kart bounds', () => {
    const envelope = createTrackEnvelope(SINGAPORE_HEARTLAND_ROUTE)
    const centre = envelope.surfaceAt(0.25, 0)
    const edge = envelope.surfaceAt(0.25, envelope.tokens.asphaltHalfWidth)

    expect(centre.classification).toBe('asphalt')
    expect(centre.point.y).toBeGreaterThan(edge.point.y)
    expect(centre.normal.length()).toBeCloseTo(1, 6)
    expect(centre.legalLateralBounds).toEqual([
      -envelope.tokens.kartHalfWidth,
      envelope.tokens.kartHalfWidth,
    ])
  })

  it('rejects a scenery footprint that overlaps the road safety envelope', () => {
    const envelope = createTrackEnvelope(SINGAPORE_HEARTLAND_ROUTE)

    expect(envelope.isFootprintClear({ progress: 0.25, lateral: 0, halfLength: 2, halfWidth: 2, yaw: 0 })).toBe(false)
    expect(envelope.isFootprintClear({
      progress: 0.25,
      lateral: envelope.tokens.sceneryClearanceOffset + 3,
      halfLength: 0.5,
      halfWidth: 0.5,
      yaw: 0,
    })).toBe(true)
  })

  it('reports required landmarks whose transformed footprint exceeds the safety envelope', () => {
    const route = {
      ...SINGAPORE_HEARTLAND_ROUTE,
      landmarks: [{
        ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0],
        id: 'unsafe-required-landmark',
        lateral: 0,
        footprint: { halfLength: 2, halfWidth: 2 },
      }],
    }

    expect(validateLandmarkClearance(route, createTrackEnvelope(route))).toEqual([
      'required landmark unsafe-required-landmark exceeds the safety envelope',
    ])
  })
})
