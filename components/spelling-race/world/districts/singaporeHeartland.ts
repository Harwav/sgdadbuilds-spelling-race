import * as THREE from 'three'
import type { GrandPrixPalette } from '../../kartModel'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import { routeTransform } from '@/lib/spelling-race/world/placement'
import { createRouteCurve } from '@/lib/spelling-race/world/routes'
import type { AssetId, DetailTier, LandmarkPlacement, RouteCard } from '@/lib/spelling-race/world/types'
import type { QualityTier } from '@/lib/spelling-race/world/quality'
import type { DistrictWorld } from '.'

type LandmarkRoot = {
  readonly placement: LandmarkPlacement
  readonly root: THREE.Group
}

export function createSingaporeHeartlandDistrict(
  card: RouteCard,
  assets: LoadedWorldAssets,
  palette: GrandPrixPalette,
): DistrictWorld {
  const root = new THREE.Group()
  root.name = 'district-singapore-heartland'
  const curve = createRouteCurve(card)
  const landmarks: LandmarkRoot[] = []
  const materials = new Set<THREE.Material>()
  const geometries = new Set<THREE.BufferGeometry>()
  const zones = createZones(root)
  let disposed = false

  try {
    card.landmarks.forEach((placement) => {
      const template = assets.models.get(placement.assetId)
      if (!template) {
        if (placement.required) throw new Error(`Loaded world model missing: ${placement.assetId}`)
        return
      }

      const model = cloneTemplate(template, materials)
      orientRoadsideFacade(model, placement)
      paintLandmark(model, placement, palette)
      configureShadows(model, placement)
      if (placement.assetId === 'shophouse-row' && placement.detailTier === 'near') {
        addOriginalFlags(model, palette, materials, geometries)
      }

      const landmarkRoot = new THREE.Group()
      landmarkRoot.name = `landmark-${placement.id}`
      landmarkRoot.userData.landmarkId = placement.id
      landmarkRoot.userData.assetId = placement.assetId
      landmarkRoot.userData.detailTier = placement.detailTier
      landmarkRoot.userData.required = placement.required
      landmarkRoot.applyMatrix4(routeTransform(curve, placement))
      landmarkRoot.add(model)
      zones[zoneFor(placement.progress)].add(landmarkRoot)
      landmarks.push({ placement, root: landmarkRoot })
    })
  } catch (error) {
    disposeOwned(root, materials, geometries)
    throw error
  }

  const setQuality = (tier: QualityTier) => {
    root.userData.qualityTier = tier
    landmarks.forEach(({ placement, root: landmarkRoot }) => {
      landmarkRoot.visible = isLandmarkVisible(placement.detailTier, placement.required, tier)
    })
  }
  setQuality('high')

  return {
    root,
    setQuality,
    dispose() {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      disposeOwned(root, materials, geometries)
    },
  }
}

function createZones(root: THREE.Group): Record<'grid' | 'hawker' | 'rail', THREE.Group> {
  const grid = zone('void-deck-grid')
  const hawker = zone('hawker-sweep')
  const rail = zone('rail-and-shophouse-turn')
  root.add(grid, hawker, rail)
  return { grid, hawker, rail }
}

function zone(name: string): THREE.Group {
  const group = new THREE.Group()
  group.name = name
  return group
}

function zoneFor(progress: number): 'grid' | 'hawker' | 'rail' {
  if (progress <= 0.2) return 'grid'
  if (progress < 0.66) return 'hawker'
  return 'rail'
}

function cloneTemplate(template: THREE.Group, materials: Set<THREE.Material>): THREE.Group {
  const clone = template.clone(true)
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => ownMaterial(material.clone(), materials))
      : ownMaterial(object.material.clone(), materials)
    object.receiveShadow = true
  })
  return clone
}

function ownMaterial<T extends THREE.Material>(material: T, materials: Set<THREE.Material>): T {
  materials.add(material)
  return material
}

function orientRoadsideFacade(model: THREE.Group, placement: LandmarkPlacement): void {
  if (!isRoadsideFacade(placement.assetId) || placement.lateral === 0) return
  model.rotation.y = Math.sign(placement.lateral) * Math.PI / 2
}

function isRoadsideFacade(assetId: AssetId): boolean {
  return assetId === 'hdb-slab'
    || assetId === 'hdb-point'
    || assetId === 'hawker-centre'
    || assetId === 'rail-station'
    || assetId === 'shophouse-row'
}

function paintLandmark(model: THREE.Group, placement: LandmarkPlacement, palette: GrandPrixPalette): void {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const colour = materialColour(placement.assetId, object.name, placement.id, palette)
    const materialList = Array.isArray(object.material) ? object.material : [object.material]
    materialList.forEach((material) => {
      const paint = material as THREE.Material & { color?: THREE.Color }
      if (colour) paint.color?.set(colour)
      if (placement.assetId === 'hawker-centre'
        && object.name === 'ceiling_light_housings'
        && material instanceof THREE.MeshStandardMaterial) {
        material.emissive.set(palette.shophouseMustard)
        material.emissiveIntensity = 0.72
      }
    })
  })
}

function materialColour(
  assetId: AssetId,
  part: string,
  landmarkId: string,
  palette: GrandPrixPalette,
): string | undefined {
  if (assetId === 'hdb-slab' || assetId === 'hdb-point') {
    if (part === 'bevelled_slab' || part === 'compact_tower') return variant(landmarkId, [palette.hdbCream, palette.hdbCoral, palette.hdbMint])
    if (part === 'void_deck') return palette.concrete
    if (part === 'corridor_bands') return palette.hdbCoral
    if (part === 'window_balcony_recesses' || part === 'repeating_window_recesses') return palette.window
  }

  if (assetId === 'hawker-centre') {
    if (part === 'open_frontage') return palette.window
    if (part === 'roof_profile') return palette.hawkerRed
    if (part === 'stall_rhythm') return palette.shophouseMustard
    if (part === 'ceiling_light_housings') return palette.shophouseMustard
  }

  if (assetId === 'hawker-table') {
    if (part === 'round_table') return palette.concrete
    if (part === 'fixed_stools') return variant(landmarkId, [palette.hawkerRed, palette.hawkerTeal, palette.shophouseMustard])
  }

  if (assetId === 'shophouse-row') {
    const facades = [palette.shophouseMustard, palette.shophouseAqua, palette.shophouseCoral]
    if (part === 'five_varied_bays') return variant(landmarkId, facades)
    if (part === 'upper_shutters') return palette.window
    if (part === 'five_foot_way_arches') return palette.concrete
    if (part === 'awnings') return variant(`${landmarkId}-awning`, facades)
  }

  if (assetId === 'rail-span') {
    if (part === 'twin_piers') return palette.concrete
    if (part === 'carriage_body') return palette.hdbCream
    if (part === 'rounded_beam' || part === 'parapets') return palette.rail
    if (part === 'two_rails') return palette.window
  }

  if (assetId === 'rail-station') {
    if (part === 'unbranded_canopy') return palette.hawkerTeal
    if (part === 'platform_mass') return palette.concrete
    if (part === 'stairs_silhouette') return palette.shophouseMustard
  }

  if (assetId === 'rain-tree') return part === 'curved_trunk' ? palette.treeTrunk : palette.treeCanopy
  if (assetId === 'street-lamp') return part === 'rounded_lamp_head' ? palette.roadMarking : palette.rail
  return undefined
}

function variant(key: string, colours: readonly string[]): string {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return colours[hash % colours.length]
}

function configureShadows(model: THREE.Group, placement: LandmarkPlacement): void {
  const shadowPart = shadowPartFor(placement.assetId)
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = placement.detailTier === 'near' && object.name === shadowPart
  })
}

function shadowPartFor(assetId: AssetId): string | undefined {
  if (assetId === 'hdb-slab') return 'bevelled_slab'
  if (assetId === 'hdb-point') return 'compact_tower'
  if (assetId === 'hawker-centre') return 'roof_profile'
  if (assetId === 'rain-tree') return 'canopy_lobes'
  if (assetId === 'rail-span') return 'rounded_beam'
  if (assetId === 'shophouse-row') return 'five_varied_bays'
  return undefined
}

function addOriginalFlags(
  model: THREE.Group,
  palette: GrandPrixPalette,
  materials: Set<THREE.Material>,
  geometries: Set<THREE.BufferGeometry>,
): void {
  const flags = new THREE.Group()
  flags.name = 'original-red-white-flags'
  const stripeGeometry = new THREE.BoxGeometry(0.92, 0.22, 0.08)
  geometries.add(stripeGeometry)
  const red = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.kerbRed, roughness: 0.72 }), materials)
  const white = ownMaterial(new THREE.MeshStandardMaterial({ color: palette.kerbWhite, roughness: 0.72 }), materials)

  const flagCentres = [-6.1, -3.05, 0, 3.05, 6.1]
  const redStripes = new THREE.InstancedMesh(stripeGeometry, red, flagCentres.length)
  redStripes.name = 'flag-red-stripes'
  const whiteStripes = new THREE.InstancedMesh(stripeGeometry, white, flagCentres.length)
  whiteStripes.name = 'flag-white-stripes'
  for (const [index, x] of flagCentres.entries()) {
    redStripes.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 5.78, -2.55))
    whiteStripes.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 5.52, -2.55))
  }
  redStripes.instanceMatrix.needsUpdate = true
  whiteStripes.instanceMatrix.needsUpdate = true
  flags.add(redStripes, whiteStripes)
  model.add(flags)
}

function isLandmarkVisible(detail: DetailTier, required: boolean, tier: QualityTier): boolean {
  if (tier === 'high') return true
  if (detail === 'distant') return false
  if (tier === 'balanced') return true
  return detail === 'near' || required
}

function disposeOwned(
  root: THREE.Group,
  materials: Set<THREE.Material>,
  geometries: Set<THREE.BufferGeometry>,
): void {
  root.clear()
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  geometries.clear()
  materials.clear()
}
