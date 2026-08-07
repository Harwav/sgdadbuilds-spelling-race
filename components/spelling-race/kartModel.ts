import * as THREE from 'three'
import type { KartColour } from '@/lib/spelling-race/types'

export type GrandPrixPalette = {
  sky: string
  grass: string
  grassShadow: string
  asphalt: string
  kerbRed: string
  kerbWhite: string
  barrierTeal: string
  barrierYellow: string
  kart: Record<KartColour, string>
  kartStripe: string
  tyre: string
  gantry: string
  gantryPost: string
  shadow: string
  treeTrunk: string
  treeCanopy: string
  sun: string
  ambient: string
  concrete: string
  hdbCream: string
  hdbCoral: string
  hdbMint: string
  shophouseMustard: string
  shophouseAqua: string
  shophouseCoral: string
  hawkerRed: string
  hawkerTeal: string
  rail: string
  window: string
  roadMarking: string
}

type KartScale = 'player' | 'rival' | 'garage'

const KART_SCALES: Readonly<Record<KartScale, number>> = {
  player: 2.35,
  rival: 2.16,
  garage: 2.35,
}

/** Material names in the Kenney race-car GLB. */
const BODY_PAINT_MATERIAL = 'red'
const RIM_PAINT_MATERIAL = 'grey'
const TYRE_MATERIAL = 'carTire'

export function readGrandPrixPalette(): GrandPrixPalette {
  const style = getComputedStyle(document.documentElement)
  const colour = (name: string) => {
    const value = style.getPropertyValue(name).trim()
    if (!value) throw new Error(`Missing Tiny Grand Prix design token: ${name}`)
    return value
  }

  return {
    sky: colour('--grand-prix-sky'),
    grass: colour('--grand-prix-grass'),
    grassShadow: colour('--grand-prix-grass-shadow'),
    asphalt: colour('--grand-prix-asphalt'),
    kerbRed: colour('--grand-prix-kerb-red'),
    kerbWhite: colour('--grand-prix-kerb-white'),
    barrierTeal: colour('--grand-prix-barrier-teal'),
    barrierYellow: colour('--grand-prix-barrier-yellow'),
    kart: {
      red: colour('--grand-prix-kart-red'),
      yellow: colour('--grand-prix-kart-yellow'),
      teal: colour('--grand-prix-kart-teal'),
      purple: colour('--grand-prix-kart-purple'),
    },
    kartStripe: colour('--grand-prix-kart-stripe'),
    tyre: colour('--grand-prix-tyre'),
    gantry: colour('--grand-prix-gantry'),
    gantryPost: colour('--grand-prix-gantry-post'),
    shadow: colour('--grand-prix-shadow'),
    treeTrunk: colour('--grand-prix-tree-trunk'),
    treeCanopy: colour('--grand-prix-tree-canopy'),
    sun: colour('--grand-prix-sun'),
    ambient: colour('--grand-prix-ambient'),
    concrete: colour('--grand-prix-concrete'),
    hdbCream: colour('--grand-prix-hdb-cream'),
    hdbCoral: colour('--grand-prix-hdb-coral'),
    hdbMint: colour('--grand-prix-hdb-mint'),
    shophouseMustard: colour('--grand-prix-shophouse-mustard'),
    shophouseAqua: colour('--grand-prix-shophouse-aqua'),
    shophouseCoral: colour('--grand-prix-shophouse-coral'),
    hawkerRed: colour('--grand-prix-hawker-red'),
    hawkerTeal: colour('--grand-prix-hawker-teal'),
    rail: colour('--grand-prix-rail'),
    window: colour('--grand-prix-window'),
    roadMarking: colour('--grand-prix-road-marking'),
  }
}

export function createKartFromTemplate(
  template: THREE.Group,
  colour: KartColour,
  palette: GrandPrixPalette,
  scale: KartScale,
): THREE.Group {
  assertKartParts(template)
  const model = template.clone(true)
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry = object.geometry.clone()
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone()
    object.castShadow = true
    object.receiveShadow = true
  })
  const group = new THREE.Group()
  group.add(model)
  group.scale.setScalar(KART_SCALES[scale])
  applyKartPaint(group, colour, palette)
  stampCollisionRadius(group)
  return group
}

export function applyKartPaint(group: THREE.Object3D, colour: KartColour, palette: GrandPrixPalette): void {
  // Imported car models use a different painting path — body meshes are
  // tracked by UUID in userData rather than by material name.
  if (Array.isArray(group.userData.carBodyMeshIds) && group.userData.carBodyMeshIds.length > 0) {
    applyCarPaint(group, colour, palette)
    return
  }

  const bodyColor = palette.kart[colour]
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    meshMaterials(object).forEach((material) => {
      if (material.name === BODY_PAINT_MATERIAL) {
        ;(material as THREE.MeshStandardMaterial).color?.set(bodyColor)
        material.needsUpdate = true
      }
      if (material.name === RIM_PAINT_MATERIAL) {
        const mat = material as THREE.MeshStandardMaterial
        mat.color?.set('#d4d4d4')
        mat.roughness = 0.28
        mat.metalness = 0.82
        mat.needsUpdate = true
      }
      if (material.name === TYRE_MATERIAL) {
        const mat = material as THREE.MeshStandardMaterial
        mat.color?.set('#222222')
        mat.roughness = 0.88
        mat.metalness = 0.04
        mat.needsUpdate = true
      }
    })
  })
  group.userData.kartColour = colour
}

/** Re-colour an imported car model's body panels without rebuilding geometry. */
function applyCarPaint(group: THREE.Object3D, colour: KartColour, palette: GrandPrixPalette): void {
  const bodyColor = palette.kart[colour]
  const bodyIds: string[] = group.userData.carBodyMeshIds ?? []
  const bodySet = new Set(bodyIds)

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (!bodySet.has(object.uuid)) return
    for (const material of meshMaterials(object)) {
      const mat = material as THREE.MeshStandardMaterial
      mat.color?.set(bodyColor)
      mat.needsUpdate = true
    }
  })
  group.userData.kartColour = colour
}

export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points)) return
    geometries.add(object.geometry)
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    objectMaterials.forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  root.clear()
}

function assertKartParts(template: THREE.Object3D): void {
  if (!template.getObjectByName('body')) throw new Error('Kart template missing named part: body')
  for (const name of ['wheelBackLeft', 'wheelBackRight', 'wheelFrontLeft', 'wheelFrontRight'] as const) {
    if (!template.getObjectByName(name)) throw new Error(`Kart template missing named part: ${name}`)
  }
}

function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

// ── Car model support (imported CC0 models for the Change Car feature) ──

/** Reference kart bounding-box size used to scale imported car models to match. */
const KART_REFERENCE_SIZE = 1.72

/**
 * Creates a player/rival/garage car from an imported GLB template.
 *
 * Imported CC0 models don't have the named materials (`red`, `grey`, `carTire`)
 * that `createKartFromTemplate` expects.  This function uses a heuristic:
 * the mesh with the largest bounding-box volume is treated as the *body* and
 * recoloured to the player's kart colour; everything else gets a dark neutral
 * treatment so wheels, trim and glass look consistent.
 */
export function createCarFromTemplate(
  template: THREE.Group,
  colour: KartColour,
  palette: GrandPrixPalette,
  scale: KartScale,
): THREE.Group {
  const model = template.clone(true)
  const meshEntries = collectMeshEntries(model).filter((e) => e.volume > 0)

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry = object.geometry.clone()
    object.material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone()
    object.castShadow = true
    object.receiveShadow = true
  })

  // Classify every mesh into body / trim / dark / window so imported CC0
  // cars look like real cars — coloured body panels, silver trim, dark
  // underbody, and white glass.
  const maxVolume = meshEntries.length > 0 ? meshEntries[0].volume : 0
  const bodyThreshold = maxVolume * 0.15
  const trimThreshold = maxVolume * 0.05

  // Measure the car's vertical extent for window detection.
  const carBox = new THREE.Box3().setFromObject(model)
  const carHeight = carBox.max.y - carBox.min.y
  const windowYFloor = carBox.min.y + carHeight * 0.58 // upper 42 % of car

  const bodyMeshes = new Set(meshEntries.filter((e) => e.volume >= bodyThreshold).map((e) => e.mesh))
  const trimMeshes = new Set(meshEntries.filter((e) => e.volume >= trimThreshold && !bodyMeshes.has(e.mesh)).map((e) => e.mesh))
  // Windows sit in the upper portion of the car and are medium-sized (0.5 %–5 % of max volume).
  const windowMin = maxVolume * 0.005
  const windowMeshes = new Set(
    meshEntries
      .filter((e) => {
        if (bodyMeshes.has(e.mesh) || trimMeshes.has(e.mesh)) return false
        if (e.volume < windowMin || e.volume >= trimThreshold) return false
        const center = new THREE.Vector3()
        new THREE.Box3().setFromObject(e.mesh).getCenter(center)
        return center.y >= windowYFloor
      })
      .map((e) => e.mesh),
  )

  const bodyMeshIds: string[] = []
  const windowMeshIds: string[] = []

  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const isBody = bodyMeshes.has(object)
    const isTrim = trimMeshes.has(object)
    const isWindow = windowMeshes.has(object)

    if (isBody) bodyMeshIds.push(object.uuid)

    for (const material of meshMaterials(object)) {
      const mat = material as THREE.MeshStandardMaterial
      if (isBody) {
        mat.color?.set(palette.kart[colour])
        mat.roughness = 0.42
        mat.metalness = 0.18
      } else if (isTrim) {
        // Bumpers, grilles, roll-cages — silver/metallic accent.
        mat.color?.set('#b0b0b0')
        mat.roughness = 0.35
        mat.metalness = 0.55
      } else if (isWindow) {
        // Glass — light grey-white with a slight blue tint.
        mat.color?.set('#e8ecf0')
        mat.roughness = 0.22
        mat.metalness = 0.12
      } else {
        // Wheels, tyres, underbody, small fixtures — dark and matte.
        mat.color?.set('#2a2a2a')
        mat.roughness = 0.78
        mat.metalness = 0.08
      }
      mat.needsUpdate = true
    }
  })

  const group = new THREE.Group()
  group.add(model)

  // Scale imported car to match the reference kart size.
  const carSize = measureSize(model)
  const targetScale = KART_SCALES[scale]
  const sizeRatio = carSize > 0 ? KART_REFERENCE_SIZE / carSize : 0.85
  group.scale.setScalar(targetScale * sizeRatio)

  group.userData.kartColour = colour
  group.userData.carBodyMeshIds = bodyMeshIds.length > 0 ? bodyMeshIds : undefined
  group.userData.carWindowMeshIds = windowMeshIds.length > 0 ? windowMeshIds : undefined
  stampCollisionRadius(group)
  return group
}

type MeshVolumeEntry = { mesh: THREE.Mesh; volume: number }

/** Collect every Mesh in the tree with its bounding-box volume, sorted largest first. */
function collectMeshEntries(root: THREE.Object3D): MeshVolumeEntry[] {
  const entries: MeshVolumeEntry[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const box = new THREE.Box3().setFromObject(object)
    const size = new THREE.Vector3()
    box.getSize(size)
    const volume = size.x * size.y * size.z
    entries.push({ mesh: object, volume })
  })
  entries.sort((a, b) => b.volume - a.volume)
  return entries
}
function stampCollisionRadius(group: THREE.Group): void {
  const box = new THREE.Box3().setFromObject(group)
  const size = new THREE.Vector3()
  box.getSize(size)
  const horizontalRadius = Math.max(size.x, size.z) * 0.5
  group.userData.collisionRadius = horizontalRadius > 0 ? horizontalRadius : KART_COLLISION_RADIUS_DEFAULT
}

/** Fallback collision radius used when userData is unavailable. */
const KART_COLLISION_RADIUS_DEFAULT = 0.525

/** Measure the longest axis of a model's bounding box. */
function measureSize(root: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  box.getSize(size)
  return Math.max(size.x, size.y, size.z)
}
