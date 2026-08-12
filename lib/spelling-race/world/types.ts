import type * as THREE from 'three'

export type RouteId = 'singapore-heartland' | 'fixture-harbour'
export type DetailTier = 'near' | 'middle' | 'distant'
export type AssetId =
  | 'kart' | 'gantry' | 'hdb-slab' | 'hdb-point' | 'shophouse-row'
  | 'hawker-centre' | 'rail-span' | 'rail-station' | 'rain-tree'
  | 'street-lamp' | 'hawker-table' | 'fixture-block'
  | 'marina-bay-sands' | 'supertree' | 'singapore-flyer'
  | 'car-sports-1' | 'car-sports-2' | 'car-sports-3' | 'car-sports-4' | 'car-sports-5'
export type TextureAssetId = 'asphalt-diffuse' | 'asphalt-normal' | 'asphalt-roughness'
export type WorldAssetId = AssetId | TextureAssetId

export type CircuitPoint = readonly [x: number, y: number, z: number]
export type LandmarkPlacement = {
  readonly id: string
  readonly assetId: AssetId
  readonly progress: number
  readonly lateral: number
  readonly elevation: number
  readonly yaw: number
  readonly scale: number
  readonly detailTier: DetailTier
  readonly required: boolean
  readonly footprint: { readonly halfLength: number; readonly halfWidth: number }
}
export type RouteCard = {
  readonly id: RouteId
  readonly label: string
  readonly shipping: boolean
  readonly circuit: { readonly points: readonly CircuitPoint[]; readonly tension: number; readonly halfWidth: number }
  readonly district: 'singapore-heartland' | 'fixture'
  readonly requiredAssets: readonly AssetId[]
  readonly optionalAssets: readonly AssetId[]
  readonly landmarks: readonly LandmarkPlacement[]
}

export type RouteCurve = THREE.CatmullRomCurve3
