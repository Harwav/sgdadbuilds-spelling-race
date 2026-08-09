import * as THREE from 'three'
import type { GrandPrixPalette } from '../../kartModel'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import { routeTransform } from '@/lib/spelling-race/world/placement'
import { createRouteCurve } from '@/lib/spelling-race/world/routes'
import type { AssetId, DetailTier, LandmarkPlacement, RouteCard } from '@/lib/spelling-race/world/types'
import type { QualityTier } from '@/lib/spelling-race/world/quality'
import type { DistrictWorld } from '.'
import { cloneBuildingModel, getCachedBuildingModels, pickBuildingModel } from '../buildingLoader'
import { createEnhancedBuilding, hashSeed, pickBuildingStyle } from '../enhancedBuildings'
import { createMarinaBaySands, createSingaporeFlyer, createSupertree } from '../singaporeLandmarks'

type LandmarkRoot = {
  readonly placement: LandmarkPlacement
  readonly root: THREE.Group
}

type FillerRoot = {
  readonly detailTier: DetailTier
  readonly root: THREE.Group
}

const FILLER_LAYOUT: Readonly<Record<DetailTier, { readonly perSide: number; readonly rows: number }>> = {
  near: { perSide: 4, rows: 3 },
  middle: { perSide: 3, rows: 2 },
  distant: { perSide: 2, rows: 1 },
}

export function createSingaporeHeartlandDistrict(
  card: RouteCard,
  assets: LoadedWorldAssets,
  palette: GrandPrixPalette,
  buildingModels?: readonly THREE.Group[],
): DistrictWorld {
  const root = new THREE.Group()
  root.name = 'district-singapore-heartland'
  const curve = createRouteCurve(card)
  const landmarks: LandmarkRoot[] = []
  const fillers: FillerRoot[] = []
  const materials = new Set<THREE.Material>()
  const geometries = new Set<THREE.BufferGeometry>()
  const zones = createZones(root)
  let disposed = false

  try {
    card.landmarks.forEach((placement) => {
      // Singapore procedural landmarks — no GLB template needed
      const isSingaporeLandmark = placement.assetId === 'marina-bay-sands'
        || placement.assetId === 'supertree'
        || placement.assetId === 'singapore-flyer'

      if (isSingaporeLandmark) {
        let model: THREE.Group
        if (placement.assetId === 'marina-bay-sands') {
          model = createMarinaBaySands(palette, { materials, geometries })
        } else if (placement.assetId === 'supertree') {
          const seed = hashSeed(placement.id)
          const treeHeight = 7 + (seed % 8) // 7-14 units
          model = createSupertree(treeHeight, palette, { materials, geometries })
        } else {
          model = createSingaporeFlyer(palette, { materials, geometries })
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
        return
      }

      const template = assets.models.get(placement.assetId)
      if (!template) {
        if (placement.required) throw new Error(`Loaded world model missing: ${placement.assetId}`)
        return
      }

      let model: THREE.Group
      const isBuilding = placement.assetId === 'hdb-slab' || placement.assetId === 'hdb-point'
      if (isBuilding) {
        const cached = buildingModels ?? getCachedBuildingModels()
        const tier = placement.detailTier
        const seed = hashSeed(placement.id)
        let baseHeight: number
        let widthScale: number

        if (cached && cached.length > 0) {
          // Real free 3D skyscraper model from Poly Pizza (CC0)
          const source = pickBuildingModel(cached, seed)
          // 庞然大物 — colossal giants looming over the track
          baseHeight = tier === 'near' ? 45 : tier === 'middle' ? 35 : 22
          widthScale = tier === 'near' ? 90 : tier === 'middle' ? 70 : 50
          const heightVariation = 1.0 + ((seed % 9) - 4) * 0.06
          model = cloneBuildingModel(source, { materials, geometries }, baseHeight * heightVariation, widthScale)

          // Neon English signage on ~40% of buildings
          if (seed % 5 < 2) {
            addNeonSigns(model, seed, palette, { materials, geometries })
          }
        } else {
          // Fallback: procedural building while models are loading
          const style = pickBuildingStyle(seed)
          const baseWidth = 3.0 + (seed % 7) * 0.4
          baseHeight = 18 + (seed % 24)
          widthScale = 15
          model = createEnhancedBuilding(style, baseWidth, baseHeight, palette, { materials, geometries })
        }

        orientRoadsideFacade(model, placement)

        // ── place the main landmark building ──
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

        // ── 3× Monaco density: wall of colossal giants packed shoulder-to-shoulder ──
        if (cached && cached.length > 0) {
          const { perSide, rows } = FILLER_LAYOUT[tier]
          const gap = 0.001 // tight but not touching — buildings clearly separated

          for (let side = -1; side <= 1; side += 2) {
            for (let row = 0; row < rows; row++) {
              for (let f = 0; f < perSide; f++) {
                const fSeed = seed + side * 7919 + row * 4093 + f * 1024 + 1
                const fSource = pickBuildingModel(cached, fSeed)
                // Each row slightly shorter for canyon depth
                const rowHeightMul = row === 0 ? 1.0 : row === 1 ? 0.82 : 0.68
                const fHeight = baseHeight * rowHeightMul * (0.88 + (fSeed % 5) * 0.05)
                const fWidth = widthScale * (0.85 + (fSeed % 4) * 0.1)
                const fModel = cloneBuildingModel(fSource, { materials, geometries }, fHeight, fWidth)

                // Pack adjacent along the track — tight gaps, visible separation
                const fProgress = placement.progress + (f - Math.floor(perSide / 2)) * gap

                // Front row right on the track, back rows step back
                const rowLateralMul = row === 0 ? 0.75 : row === 1 ? 1.02 : 1.28
                const fLateral = placement.lateral * side * rowLateralMul

                const fPlacement: LandmarkPlacement = {
                  ...placement,
                  lateral: fLateral,
                  progress: THREE.MathUtils.clamp(fProgress, 0, 1),
                }
                orientRoadsideFacade(fModel, fPlacement)

                if ((fSeed % 5) < 2) {
                  addNeonSigns(fModel, fSeed, palette, { materials, geometries })
                }

                const fRoot = new THREE.Group()
                fRoot.name = `filler-${placement.id}-s${side}-r${row}-${f}`
                fRoot.applyMatrix4(routeTransform(curve, fPlacement))
                fRoot.add(fModel)
                zones[zoneFor(THREE.MathUtils.clamp(fProgress, 0, 1))].add(fRoot)
                fillers.push({ detailTier: tier, root: fRoot })
              }
            }
          }
        }
      } else {
        model = cloneTemplate(template, materials)
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
      }
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
    fillers.forEach(({ detailTier, root: fillerRoot }) => {
      fillerRoot.visible = isFillerVisible(detailTier, tier)
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
  // Rotate so the detailed / striped facade faces the track
  model.rotation.y = -Math.sign(placement.lateral) * Math.PI / 2
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

function isFillerVisible(detail: DetailTier, tier: QualityTier): boolean {
  if (tier === 'high') return true
  if (tier === 'balanced') return detail === 'near'
  return false
}

/**
 * Add neon-lit English-style signage panels to a building facade.
 * Bright emissive rectangles mimic Times-Square / Shibuya-style billboards.
 */
function addNeonSigns(
  model: THREE.Group,
  seed: number,
  palette: GrandPrixPalette,
  owned: { materials: Set<THREE.Material>; geometries: Set<THREE.BufferGeometry> },
): void {
  const signGroup = new THREE.Group()
  signGroup.name = 'neon-signs'

  const neonColours = [
    { colour: 0xff1493, emissive: 0xff1493 }, // deep pink
    { colour: 0x00ffff, emissive: 0x00ffff }, // cyan
    { colour: 0xffff00, emissive: 0xffff00 }, // yellow
    { colour: 0x39ff14, emissive: 0x39ff14 }, // neon green
    { colour: 0xff4500, emissive: 0xff4500 }, // orange-red
    { colour: 0xbf00ff, emissive: 0xbf00ff }, // purple
    { colour: 0xff69b4, emissive: 0xff69b4 }, // hot pink
    { colour: 0x00ff7f, emissive: 0x00ff7f }, // spring green
  ]

  const signCount = 2 + (seed % 4) // 2–5 signs per building
  for (let i = 0; i < signCount; i++) {
    const si = (seed + i * 313) % neonColours.length
    const { colour, emissive } = neonColours[si]
    const mat = new THREE.MeshStandardMaterial({
      color: colour,
      emissive,
      emissiveIntensity: 0.9 + (seed % 3) * 0.3,
      roughness: 0.2,
      metalness: 0.1,
    })
    owned.materials.add(mat)

    // Mix of horizontal bands and vertical strips
    const isHorizontal = (seed + i) % 3 !== 0
    const signGeo: THREE.BoxGeometry = isHorizontal
      ? new THREE.BoxGeometry(1.6 + (seed % 7) * 0.3, 0.28, 0.08)
      : new THREE.BoxGeometry(0.25, 1.4 + (seed % 5) * 0.4, 0.08)
    owned.geometries.add(signGeo)

    const sign = new THREE.Mesh(signGeo, mat)

    // Position signs at various heights and sides of the building
    const face = i % 4
    const heightFrac = 0.2 + (i / signCount) * 0.65
    const buildingHeight = 8 // approximate — signs float relative to model origin
    sign.position.y = buildingHeight * heightFrac

    // Place on different faces of the building
    const buildingHalfWidth = 0.6
    switch (face) {
      case 0: sign.position.z = buildingHalfWidth; break
      case 1: sign.position.z = -buildingHalfWidth; sign.rotation.y = Math.PI; break
      case 2: sign.position.x = buildingHalfWidth; sign.rotation.y = Math.PI / 2; break
      case 3: sign.position.x = -buildingHalfWidth; sign.rotation.y = -Math.PI / 2; break
    }

    signGroup.add(sign)
  }

  model.add(signGroup)
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
