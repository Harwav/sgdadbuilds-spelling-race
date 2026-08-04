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

type KartPaintPart = 'paint_body' | 'paint_stripe' | 'rims'
type KartScale = 'player' | 'rival' | 'garage'

const KART_SCALES: Readonly<Record<KartScale, number>> = {
  player: 0.48,
  rival: 0.44,
  garage: 0.48,
}

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
    object.castShadow = object.name === 'paint_body'
    object.receiveShadow = object.name !== 'contact_shadow'

    if (object.name === 'contact_shadow') {
      meshMaterials(object).forEach((material) => {
        material.transparent = true
        material.opacity = Math.min(material.opacity, 0.3)
        material.depthWrite = false
      })
    }
  })
  model.rotation.y = Math.PI
  const group = new THREE.Group()
  group.add(model)
  group.scale.setScalar(KART_SCALES[scale])
  applyKartPaint(group, colour, palette)
  return group
}

export function applyKartPaint(group: THREE.Object3D, colour: KartColour, palette: GrandPrixPalette): void {
  const colours: Record<KartPaintPart, string> = {
    paint_body: palette.kart[colour],
    paint_stripe: palette.kartStripe,
    rims: palette.kart[colour],
  }
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const part = object.name
    if (!isKartPaintPart(part)) return
    meshMaterials(object).forEach((material) => {
      const paint = material as THREE.Material & { color?: THREE.Color }
      paint.color?.set(colours[part])
    })
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
  for (const name of ['paint_body', 'paint_stripe', 'tyres', 'rims', 'visor', 'contact_shadow'] as const) {
    if (!template.getObjectByName(name)) throw new Error(`Kart template missing named part: ${name}`)
  }
}

function isKartPaintPart(name: string): name is KartPaintPart {
  return name === 'paint_body' || name === 'paint_stripe' || name === 'rims'
}

function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}
