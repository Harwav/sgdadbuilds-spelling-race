import type * as THREE from 'three'
import type { GrandPrixPalette } from '../../kartModel'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import type { QualityTier } from '@/lib/spelling-race/world/quality'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import { createFixtureDistrict } from './fixtureDistrict'
import { createSingaporeHeartlandDistrict } from './singaporeHeartland'

export type DistrictWorld = {
  readonly root: THREE.Group
  setQuality(tier: QualityTier): void
  dispose(): void
}

export function createDistrictWorld(
  card: RouteCard,
  assets: LoadedWorldAssets,
  palette: GrandPrixPalette,
): DistrictWorld {
  if (card.district === 'singapore-heartland') return createSingaporeHeartlandDistrict(card, assets, palette)
  if (card.district === 'fixture') return createFixtureDistrict(card, assets)
  return assertNever(card.district)
}

function assertNever(value: never): never {
  throw new Error(`Unknown district: ${String(value)}`)
}
