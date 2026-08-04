import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { routeTransform } from './placement'
import { FIXTURE_HARBOUR_ROUTE, SINGAPORE_HEARTLAND_ROUTE, createRouteCurve } from './routes'

describe('route-relative placement', () => {
  it('places the same landmark relative to each route curve without mutating its fields', () => {
    const placement = SINGAPORE_HEARTLAND_ROUTE.landmarks[0]
    const originalPlacement = { ...placement }
    const singapore = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const fixture = createRouteCurve(FIXTURE_HARBOUR_ROUTE)

    const singaporePosition = new THREE.Vector3().setFromMatrixPosition(routeTransform(singapore, placement))
    const fixturePosition = new THREE.Vector3().setFromMatrixPosition(routeTransform(fixture, placement))
    const singaporePoint = singapore.getPointAt(placement.progress)
    const fixturePoint = fixture.getPointAt(placement.progress)

    expect(placement).toEqual(originalPlacement)
    expect(singaporePosition.y).toBeCloseTo(singaporePoint.y + placement.elevation)
    expect(fixturePosition.y).toBeCloseTo(fixturePoint.y + placement.elevation)
    expect(singaporePosition.distanceTo(fixturePosition)).toBeGreaterThan(1)
  })

  it('applies lateral distance, route tangent yaw, placement yaw, and uniform scale', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(10, 0, 20),
      new THREE.Vector3(20, 0, 20),
    ])
    const matrix = routeTransform(curve, {
      id: 'test', assetId: 'gantry', progress: 0, lateral: 3, elevation: 2, yaw: Math.PI / 2, scale: 4,
      detailTier: 'near', required: true,
    })
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    matrix.decompose(position, rotation, scale)

    expect(position.x).toBeCloseTo(3, 3)
    expect(position.y).toBeCloseTo(2)
    expect(position.z).toBeCloseTo(0, 3)
    expect(scale).toEqual(new THREE.Vector3(4, 4, 4))
    expect(new THREE.Euler().setFromQuaternion(rotation).y).toBeCloseTo(Math.PI / 2)
  })
})
