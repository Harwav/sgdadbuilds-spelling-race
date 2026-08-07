import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { routeTransform } from './placement'
import {
  createRouteCurve,
  FIXTURE_HARBOUR_ROUTE,
  SINGAPORE_HEARTLAND_ROUTE,
  routeCard,
  shippingRoutes,
  validateRouteCard,
} from './routes'

describe('route cards', () => {
  it('keeps only Singapore Heartland in the shipping registry', () => {
    expect(shippingRoutes().map((route) => route.id)).toEqual(['singapore-heartland'])
  })

  it('locks the 52-landmark Singapore route shape and its authored zone anchors', () => {
    expect(SINGAPORE_HEARTLAND_ROUTE.landmarks.map(({ id, assetId, progress, elevation }) => [
      id, assetId, progress, elevation,
    ])).toEqual([
      ['hdb-east-slab', 'hdb-slab', 0.00, 0],
      ['hdb-grid-1', 'hdb-point', 0.015, 0],
      ['hdb-east-point', 'hdb-point', 0.04, 0],
      ['hdb-grid-2', 'hdb-point', 0.055, 0],
      ['hdb-east-lamp', 'street-lamp', 0.08, 0],
      ['hdb-grid-3', 'hdb-point', 0.095, 0],
      ['hdb-central-slab', 'hdb-slab', 0.12, 0],
      ['hdb-grid-4', 'hdb-point', 0.135, 0],
      ['hdb-central-point', 'hdb-point', 0.16, 0],
      ['hdb-grid-5', 'hdb-point', 0.175, 0],
      ['hdb-west-slab', 'hdb-slab', 0.20, 0],
      ['hdb-grid-6', 'hdb-point', 0.195, 0],
      ['hdb-hawker-1', 'hdb-point', 0.23, 0],
      ['hdb-hawker-2', 'hdb-point', 0.27, 0],
      ['supertree-1', 'supertree', 0.285, 0],
      ['supertree-2', 'supertree', 0.305, 0],
      ['supertree-3', 'supertree', 0.325, 0],
      ['supertree-4', 'supertree', 0.345, 0],
      ['supertree-5', 'supertree', 0.365, 0],
      ['hdb-hawker-3', 'hdb-point', 0.31, 0],
      ['hdb-hawker-4', 'hdb-point', 0.335, 0],
      ['hawker-centre', 'hawker-centre', 0.355, 0],
      ['hawker-rain-tree', 'rain-tree', 0.37, 0],
      ['hawker-table-east', 'hawker-table', 0.347, 0],
      ['hawker-table-west', 'hawker-table', 0.37, 0],
      ['hdb-hawker-5', 'hdb-point', 0.39, 0],
      ['hdb-hawker-6', 'hdb-point', 0.43, 0],
      ['hdb-hawker-7', 'hdb-point', 0.47, 0],
      ['mbs-skyline', 'marina-bay-sands', 0.50, 0],
      ['hdb-hawker-8', 'hdb-point', 0.51, 0],
      ['hdb-hawker-9', 'hdb-point', 0.55, 0],
      ['flyer-skyline', 'singapore-flyer', 0.58, 0],
      ['hdb-hawker-10', 'hdb-point', 0.59, 0],
      ['hdb-hawker-11', 'hdb-point', 0.63, 0],
      ['rail-span-start', 'rail-span', 0.68, 0],
      ['hdb-rail-1', 'hdb-point', 0.695, 0],
      ['hdb-rail-2', 'hdb-point', 0.725, 0],
      ['rail-station', 'rail-station', 0.80, 0],
      ['shophouse-row-east', 'shophouse-row', 0.76, 0],
      ['rail-span-middle', 'rail-span', 0.76, 0],
      ['hdb-rail-3', 'hdb-point', 0.785, 0],
      ['hdb-rail-4', 'hdb-point', 0.815, 0],
      ['shophouse-row-west', 'shophouse-row', 0.86, 0],
      ['rail-span-end', 'rail-span', 0.84, 0],
      ['hdb-rail-5', 'hdb-point', 0.855, 0],
      ['skyline-slab-east', 'hdb-slab', 0.88, 0],
      ['hdb-rail-6', 'hdb-point', 0.895, 0],
      ['skyline-slab-west', 'hdb-slab', 0.92, 0],
      ['hdb-rail-7', 'hdb-point', 0.91, 0],
      ['hdb-rail-8', 'hdb-point', 0.945, 0],
      ['hdb-rail-9', 'hdb-point', 0.965, 0],
      ['hdb-rail-10', 'hdb-point', 0.985, 0],
    ])
  })

  it('covers the rail-and-shophouse zone with required grounded spans from 0.68 through 0.84', () => {
    expect(SINGAPORE_HEARTLAND_ROUTE.landmarks
      .filter((landmark) => landmark.assetId === 'rail-span')
      .map(({ progress, elevation, detailTier, required }) => ({ progress, elevation, detailTier, required })))
      .toEqual([
        { progress: 0.68, elevation: 0, detailTier: 'near', required: true },
        { progress: 0.76, elevation: 0, detailTier: 'near', required: true },
        { progress: 0.84, elevation: 0, detailTier: 'near', required: true },
      ])
  })

  it('runs the elevated rail continuously along one roadside instead of across the asphalt', () => {
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const spans = SINGAPORE_HEARTLAND_ROUTE.landmarks.filter((landmark) => landmark.assetId === 'rail-span')
    const side = Math.sign(spans[0].lateral)

    expect(side).not.toBe(0)
    for (const span of spans) {
      const tangent = curve.getTangentAt(span.progress).normalize()
      const spanAxis = new THREE.Vector3(1, 0, 0).transformDirection(routeTransform(curve, span))

      expect(Math.sign(span.lateral)).toBe(side)
      expect(Math.abs(span.lateral)).toBeGreaterThan(SINGAPORE_HEARTLAND_ROUTE.circuit.halfWidth + 4)
      expect(Math.abs(spanAxis.dot(tangent))).toBeGreaterThan(0.98)
    }
  })

  it('keeps the first shophouse row wholly ahead of the rail checkpoint on the opposite roadside', () => {
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const railSide = Math.sign(SINGAPORE_HEARTLAND_ROUTE.landmarks.find((landmark) => landmark.assetId === 'rail-span')!.lateral)
    const nearestShophouse = SINGAPORE_HEARTLAND_ROUTE.landmarks
      .filter((landmark) => landmark.assetId === 'shophouse-row')
      .sort((a, b) => a.progress - b.progress)[0]
    const routeDistanceAhead = curve.getLength() * (nearestShophouse.progress - 0.68)
    const shophouseHalfLength = 15.25 * nearestShophouse.scale / 2

    expect(Math.sign(nearestShophouse.lateral)).toBe(-railSide)
    expect(routeDistanceAhead).toBeGreaterThan(shophouseHalfLength + 4)
  })

  it('places both table groups beside the hawker frontage rather than in later zones', () => {
    const hawker = SINGAPORE_HEARTLAND_ROUTE.landmarks.find((landmark) => landmark.assetId === 'hawker-centre')!
    const tables = SINGAPORE_HEARTLAND_ROUTE.landmarks.filter((landmark) => landmark.assetId === 'hawker-table')

    expect(tables).toHaveLength(2)
    for (const table of tables) {
      expect(Math.abs(table.progress - hawker.progress)).toBeLessThanOrEqual(0.04)
      expect(Math.sign(table.lateral)).toBe(Math.sign(hawker.lateral))
    }
  })

  it('rejects a circuit with fewer than four points', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      circuit: { ...SINGAPORE_HEARTLAND_ROUTE.circuit, points: SINGAPORE_HEARTLAND_ROUTE.circuit.points.slice(0, 3) },
    })).toContain('circuit.points must contain at least 4 points')
  })

  it('rejects duplicate landmark IDs', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      landmarks: [
        ...SINGAPORE_HEARTLAND_ROUTE.landmarks,
        { ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0] },
      ],
    })).toContain('landmarks[52].id duplicates landmarks[0].id')
  })

  it('rejects landmark progress outside the circuit', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      landmarks: [
        ...SINGAPORE_HEARTLAND_ROUTE.landmarks,
        { ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0], id: 'outside-circuit', progress: 1.1 },
      ],
    })).toContain('landmarks[52].progress must be between 0 and 1')
  })

  it('rejects non-positive landmark scale', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      landmarks: [
        ...SINGAPORE_HEARTLAND_ROUTE.landmarks,
        { ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0], id: 'flat-landmark', scale: 0 },
      ],
    })).toContain('landmarks[52].scale must be greater than 0')
  })

  it('rejects landmarks whose asset is not listed for the route', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      landmarks: [
        ...SINGAPORE_HEARTLAND_ROUTE.landmarks,
        { ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0], id: 'missing-asset', assetId: 'fixture-block' },
      ],
    })).toContain('landmarks[52].assetId must be listed in requiredAssets or optionalAssets')
  })

  it('rejects assets listed as both required and optional', () => {
    expect(validateRouteCard({
      ...SINGAPORE_HEARTLAND_ROUTE,
      optionalAssets: [...SINGAPORE_HEARTLAND_ROUTE.optionalAssets, 'kart'],
    })).toContain('asset kart cannot be both required and optional')
  })

  it('rejects a shipping fixture', () => {
    expect(validateRouteCard({ ...FIXTURE_HARBOUR_ROUTE, shipping: true })).toContain('fixture routes cannot ship')
  })

  it('requires the shared renderer models in the fixture route bundle', () => {
    expect(FIXTURE_HARBOUR_ROUTE.requiredAssets).toEqual(['kart', 'gantry', 'fixture-block'])
  })

  it('returns cards by known ID and rejects unknown registry IDs', () => {
    expect(routeCard('singapore-heartland')).toBe(SINGAPORE_HEARTLAND_ROUTE)
    expect(() => routeCard('unknown-route' as never)).toThrow('Unknown route card: unknown-route')
  })
})
