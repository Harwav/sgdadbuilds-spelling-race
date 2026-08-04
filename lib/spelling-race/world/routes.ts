import * as THREE from 'three'
import type { AssetId, LandmarkPlacement, RouteCard, RouteId } from './types'

const SHARED_RENDERER_ASSETS = ['kart', 'gantry'] as const
const REQUIRED_ASSETS = [...SHARED_RENDERER_ASSETS, 'hdb-slab', 'shophouse-row', 'hawker-centre', 'rail-span', 'rain-tree'] as const
const OPTIONAL_ASSETS = ['hdb-point', 'rail-station', 'street-lamp', 'hawker-table'] as const

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
    landmark('hdb-east-slab', 'hdb-slab', 0.00, 10, 0, 0.08, 1.25, 'near', true),
    landmark('hdb-east-point', 'hdb-point', 0.04, 14, 0, -0.15, 1.05, 'near', false),
    landmark('hdb-east-lamp', 'street-lamp', 0.08, -9, 0, 0, 0.9, 'near', false),
    landmark('hdb-central-slab', 'hdb-slab', 0.12, 11, 0, -0.1, 1.35, 'near', true),
    landmark('hdb-central-point', 'hdb-point', 0.16, -12, 0, 0.12, 1.1, 'middle', false),
    landmark('hdb-west-slab', 'hdb-slab', 0.20, 10, 0, -0.06, 1.2, 'middle', true),
    landmark('hawker-centre', 'hawker-centre', 0.355, 12, 0, 0.08, 0.95, 'near', true),
    landmark('hawker-rain-tree', 'rain-tree', 0.37, -10, 0, -0.1, 1.3, 'near', true),
    landmark('hawker-table-east', 'hawker-table', 0.347, 8.8, 0, 0.12, 0.85, 'middle', false),
    landmark('hawker-table-west', 'hawker-table', 0.37, 9.4, 0, -0.08, 0.8, 'middle', false),
    landmark('rail-span-start', 'rail-span', 0.68, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('rail-station', 'rail-station', 0.80, 14.5, 0, -0.05, 0.72, 'middle', false),
    landmark('shophouse-row-east', 'shophouse-row', 0.76, -11, 0, -0.14, 1.18, 'near', true),
    landmark('rail-span-middle', 'rail-span', 0.76, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('shophouse-row-west', 'shophouse-row', 0.86, -11.5, 0, -0.1, 1.05, 'middle', true),
    landmark('rail-span-end', 'rail-span', 0.84, 14.5, 0, Math.PI / 2, 0.9, 'near', true),
    landmark('skyline-slab-east', 'hdb-slab', 0.88, 14, 0, 0.08, 1.4, 'distant', true),
    landmark('skyline-slab-west', 'hdb-slab', 0.92, -13, 0, -0.1, 1.3, 'distant', true),
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
