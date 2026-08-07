import * as THREE from 'three'
import type { AssetId, LandmarkPlacement, RouteCard, RouteId } from './types'

const SHARED_RENDERER_ASSETS = ['kart', 'gantry'] as const
const REQUIRED_ASSETS = [...SHARED_RENDERER_ASSETS, 'hdb-slab', 'shophouse-row', 'hawker-centre', 'rail-span', 'rain-tree'] as const
const OPTIONAL_ASSETS = ['hdb-point', 'rail-station', 'street-lamp', 'hawker-table', 'marina-bay-sands', 'supertree', 'singapore-flyer', 'car-sports-1', 'car-sports-2', 'car-sports-3', 'car-sports-4', 'car-sports-5'] as const

export const SINGAPORE_HEARTLAND_ROUTE: RouteCard = {
  id: 'singapore-heartland',
  label: 'Singapore Heartland',
  shipping: true,
  district: 'singapore-heartland',
  circuit: {
    points: [
      [0, 0, -39], [25, 0, -35], [42, 0, -20], [44, 0, 4], [34, 0, 27], [10, 0, 38],
      [-17, 0, 36], [-38, 0, 22], [-44, 0, -1], [-35, 0, -26], [-15, 0, -38],
    ],
    tension: 0.42,
    halfWidth: 5.6,
  },
  requiredAssets: REQUIRED_ASSETS,
  optionalAssets: OPTIONAL_ASSETS,
  landmarks: [
    // ── Void-deck grid zone (0.00 – 0.20) ──────────────────────────
    landmark('hdb-east-slab', 'hdb-slab', 0.00, 10, 0, 0.08, 1.25, 'near', true),
    landmark('hdb-grid-1', 'hdb-point', 0.015, -9.5, 0, -0.12, 1.0, 'near', false),
    landmark('hdb-east-point', 'hdb-point', 0.04, 14, 0, -0.15, 1.05, 'near', false),
    landmark('hdb-grid-2', 'hdb-point', 0.055, -12, 0, 0.1, 0.95, 'middle', false),
    landmark('hdb-east-lamp', 'street-lamp', 0.08, -9, 0, 0, 0.9, 'near', false),
    landmark('hdb-grid-3', 'hdb-point', 0.095, 13, 0, -0.08, 1.1, 'near', false),
    landmark('hdb-central-slab', 'hdb-slab', 0.12, 11, 0, -0.1, 1.35, 'near', true),
    landmark('hdb-grid-4', 'hdb-point', 0.135, -11.5, 0, 0.14, 1.0, 'middle', false),
    landmark('hdb-central-point', 'hdb-point', 0.16, -12, 0, 0.12, 1.1, 'middle', false),
    landmark('hdb-grid-5', 'hdb-point', 0.175, 12.5, 0, -0.06, 1.05, 'near', false),
    landmark('hdb-west-slab', 'hdb-slab', 0.20, 10, 0, -0.06, 1.2, 'middle', true),
    landmark('hdb-grid-6', 'hdb-point', 0.195, -13.5, 0, 0.09, 0.9, 'middle', false),

    // ── Hawker sweep zone (0.20 – 0.66) ────────────────────────────
    landmark('hdb-hawker-1', 'hdb-point', 0.23, -10, 0, -0.11, 1.05, 'middle', false),
    landmark('hdb-hawker-2', 'hdb-point', 0.27, 12, 0, 0.13, 1.1, 'near', false),

    // Supertree Grove — Gardens by the Bay-inspired vertical gardens
    landmark('supertree-1', 'supertree', 0.285, -13, 0, -0.05, 1.0, 'near', false),
    landmark('supertree-2', 'supertree', 0.305, -14.5, 0, 0.08, 0.85, 'middle', false),
    landmark('supertree-3', 'supertree', 0.325, -12, 0, -0.12, 1.1, 'near', false),
    landmark('supertree-4', 'supertree', 0.345, -14, 0, 0.04, 0.9, 'middle', false),
    landmark('supertree-5', 'supertree', 0.365, -13.5, 0, -0.07, 0.95, 'near', false),

    landmark('hdb-hawker-3', 'hdb-point', 0.31, -12.5, 0, -0.07, 0.95, 'middle', false),
    landmark('hdb-hawker-4', 'hdb-point', 0.335, 14, 0, 0.1, 1.0, 'middle', false),
    landmark('hawker-centre', 'hawker-centre', 0.355, 12, 0, 0.08, 0.95, 'near', true),
    landmark('hawker-rain-tree', 'rain-tree', 0.37, -10, 0, -0.1, 1.3, 'near', true),
    landmark('hawker-table-east', 'hawker-table', 0.347, 8.8, 0, 0.12, 0.85, 'middle', false),
    landmark('hawker-table-west', 'hawker-table', 0.37, 9.4, 0, -0.08, 0.8, 'middle', false),
    landmark('hdb-hawker-5', 'hdb-point', 0.39, -11, 0, -0.14, 1.15, 'near', false),
    landmark('hdb-hawker-6', 'hdb-point', 0.43, 12, 0, 0.08, 1.0, 'middle', false),
    landmark('hdb-hawker-7', 'hdb-point', 0.47, -14, 0, -0.05, 0.9, 'distant', false),

    // Marina Bay Sands — three-tower integrated resort skyline icon
    landmark('mbs-skyline', 'marina-bay-sands', 0.50, 17, 0, 0.06, 1.15, 'distant', false),

    landmark('hdb-hawker-8', 'hdb-point', 0.51, 11, 0, 0.12, 1.1, 'near', false),
    landmark('hdb-hawker-9', 'hdb-point', 0.55, -12, 0, -0.09, 1.0, 'middle', false),

    // Singapore Flyer — giant observation wheel
    landmark('flyer-skyline', 'singapore-flyer', 0.58, -16, 0, 0.04, 1.05, 'distant', false),

    landmark('hdb-hawker-10', 'hdb-point', 0.59, 14, 0, 0.06, 0.95, 'middle', false),
    landmark('hdb-hawker-11', 'hdb-point', 0.63, -10.5, 0, -0.13, 1.05, 'near', false),

    // ── Rail & shophouse turn zone (0.66 – 1.00) ───────────────────
    landmark('rail-span-start', 'rail-span', 0.68, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('hdb-rail-1', 'hdb-point', 0.695, -12, 0, -0.1, 1.05, 'middle', false),
    landmark('hdb-rail-2', 'hdb-point', 0.725, 11.5, 0, 0.14, 1.1, 'near', false),
    landmark('rail-station', 'rail-station', 0.80, 14.5, 0, -0.05, 0.72, 'middle', false),
    landmark('shophouse-row-east', 'shophouse-row', 0.76, -11, 0, -0.14, 1.18, 'near', true),
    landmark('rail-span-middle', 'rail-span', 0.76, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('hdb-rail-3', 'hdb-point', 0.785, -14, 0, -0.06, 0.95, 'middle', false),
    landmark('hdb-rail-4', 'hdb-point', 0.815, 13, 0, 0.09, 1.05, 'near', false),
    landmark('shophouse-row-west', 'shophouse-row', 0.86, -11.5, 0, -0.1, 1.05, 'middle', true),
    landmark('rail-span-end', 'rail-span', 0.84, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('hdb-rail-5', 'hdb-point', 0.855, -13, 0, -0.12, 1.0, 'middle', false),
    landmark('skyline-slab-east', 'hdb-slab', 0.88, 14, 0, 0.08, 1.4, 'distant', true),
    landmark('hdb-rail-6', 'hdb-point', 0.895, 12, 0, 0.07, 0.9, 'distant', false),
    landmark('skyline-slab-west', 'hdb-slab', 0.92, -13, 0, -0.1, 1.3, 'distant', true),
    landmark('hdb-rail-7', 'hdb-point', 0.91, -11.5, 0, -0.08, 0.85, 'distant', false),
    landmark('hdb-rail-8', 'hdb-point', 0.945, 14, 0, 0.11, 0.9, 'distant', false),
    landmark('hdb-rail-9', 'hdb-point', 0.965, -12, 0, -0.09, 0.85, 'distant', false),
    landmark('hdb-rail-10', 'hdb-point', 0.985, 11, 0, 0.13, 0.9, 'distant', false),
  ],
}

export const FIXTURE_HARBOUR_ROUTE: RouteCard = {
  id: 'fixture-harbour',
  label: 'Fixture Harbour',
  shipping: false,
  district: 'fixture',
  circuit: {
    points: [[-30, 0, -20], [30, 0, -20], [40, 0, 0], [30, 0, 20], [-30, 0, 20], [-40, 0, 0]],
    tension: 0.5,
    halfWidth: 5.6,
  },
  requiredAssets: [...SHARED_RENDERER_ASSETS, 'fixture-block'],
  optionalAssets: [],
  landmarks: [landmark('fixture-block', 'fixture-block', 0.25, 9, 0, 0, 1, 'near', true)],
}

const ROUTES: Readonly<Record<RouteId, RouteCard>> = {
  'singapore-heartland': SINGAPORE_HEARTLAND_ROUTE,
  'fixture-harbour': FIXTURE_HARBOUR_ROUTE,
}

export function shippingRoutes(): readonly RouteCard[] {
  return Object.values(ROUTES).filter((route) => route.shipping)
}

export function validateRouteCard(card: RouteCard): readonly string[] {
  const errors: string[] = []
  if (card.circuit.points.length < 4) errors.push('circuit.points must contain at least 4 points')

  const optionalAssets = new Set(card.optionalAssets)
  for (const assetId of card.requiredAssets) {
    if (optionalAssets.has(assetId)) errors.push(`asset ${assetId} cannot be both required and optional`)
  }

  const knownAssets = new Set<AssetId>([...card.requiredAssets, ...card.optionalAssets])
  const landmarkIndexes = new Map<string, number>()
  card.landmarks.forEach((landmark, index) => {
    const duplicateIndex = landmarkIndexes.get(landmark.id)
    if (duplicateIndex === undefined) landmarkIndexes.set(landmark.id, index)
    else errors.push(`landmarks[${index}].id duplicates landmarks[${duplicateIndex}].id`)
    if (!knownAssets.has(landmark.assetId)) errors.push(`landmarks[${index}].assetId must be listed in requiredAssets or optionalAssets`)
    if (landmark.progress < 0 || landmark.progress > 1) errors.push(`landmarks[${index}].progress must be between 0 and 1`)
    if (landmark.scale <= 0) errors.push(`landmarks[${index}].scale must be greater than 0`)
  })

  if (card.district === 'fixture' && card.shipping) errors.push('fixture routes cannot ship')
  return errors
}

export function routeCard(id: RouteId): RouteCard {
  const card = ROUTES[id]
  if (!card) throw new Error(`Unknown route card: ${id}`)
  return card
}

export function createRouteCurve(card: RouteCard): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    card.circuit.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    'catmullrom',
    card.circuit.tension,
  )
}

function landmark(
  id: string,
  assetId: AssetId,
  progress: number,
  lateral: number,
  elevation: number,
  yaw: number,
  scale: number,
  detailTier: LandmarkPlacement['detailTier'],
  required: boolean,
): LandmarkPlacement {
  return { id, assetId, progress, lateral, elevation, yaw, scale, detailTier, required }
}
