import { describe, expect, it } from 'vitest'
import { createTrackEnvelope, validateLandmarkClearance } from './trackEnvelope'
import { SINGAPORE_HEARTLAND_ROUTE } from './routes'
import { createTrackWorld } from '@/components/spelling-race/world/track'
import { createWorldMaterials } from '@/components/spelling-race/world/materials'
import * as THREE from 'three'

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

  it('renders distinct named road bands outside the asphalt using the envelope', () => {
    const track = createTrackWorld(SINGAPORE_HEARTLAND_ROUTE, materials())

    expect(track.envelope).toBeDefined()
    expect(track.root.getObjectByName('track-kerbs')).toBeDefined()
    expect(track.root.getObjectByName('track-runoff')).toBeDefined()
    expect(track.root.getObjectByName('track-barriers')).toBeDefined()
  })
})

function materials() {
  return createWorldMaterials(palette(), {
    routeId: 'singapore-heartland',
    models: new Map(),
    textures: new Map([
      ['asphalt-diffuse', new THREE.Texture()],
      ['asphalt-normal', new THREE.Texture()],
      ['asphalt-roughness', new THREE.Texture()],
    ]),
    missingOptional: [],
  })
}

function palette() {
  return {
    sky: '#8ac', grass: '#284', grassShadow: '#173', asphalt: '#222', kerbRed: '#d44', kerbWhite: '#fff',
    barrierTeal: '#299', barrierYellow: '#fd4', kart: { red: '#d22', yellow: '#fd2', teal: '#299', purple: '#93c' },
    kartStripe: '#fff', tyre: '#222', gantry: '#111', gantryPost: '#299', shadow: '#111', treeTrunk: '#642',
    treeCanopy: '#284', sun: '#fff', ambient: '#def', concrete: '#bbb', hdbCream: '#fed', hdbCoral: '#d76',
    hdbMint: '#8ba', shophouseMustard: '#da4', shophouseAqua: '#4aa', shophouseCoral: '#d76', hawkerRed: '#d44',
    hawkerTeal: '#299', rail: '#888', window: '#9bd', roadMarking: '#fff',
  }
}
