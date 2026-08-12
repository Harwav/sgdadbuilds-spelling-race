import * as THREE from 'three'

// Only skyscraper / high-rise models — no farmhouses, shops, or low buildings.
const BUILDING_MODEL_PATHS = [
  '/spelling-race/assets/models/buildings/poly-building-b946d1a0.glb',
  '/spelling-race/assets/models/buildings/poly-building-238cf4fb.glb',
  '/spelling-race/assets/models/buildings/poly-building-28951518.glb',
  '/spelling-race/assets/models/buildings/poly-building-6c49f4dd.glb',
  '/spelling-race/assets/models/buildings/poly-skyscraper-2bd81cbf.glb',
  '/spelling-race/assets/models/buildings/poly-skyscraper-71ba3a39.glb',
  '/spelling-race/assets/models/buildings/poly-skyscraper-2532ccc4.glb',
  '/spelling-race/assets/models/buildings/poly-skyscraper-c3649afd.glb',
  '/spelling-race/assets/models/buildings/poly-skyscraper-d54887ba.glb',
  '/spelling-race/assets/models/buildings/poly-new-yKo7F36Qk2.glb',
  '/spelling-race/assets/models/buildings/poly-new-sxXonOmtct.glb',
  '/spelling-race/assets/models/buildings/poly-new-fGKIlWGDNH.glb',
  '/spelling-race/assets/models/buildings/poly-new-fuAgJluDLwx.glb',
  '/spelling-race/assets/models/buildings/poly-new-lbNz2dClar.glb',
  '/spelling-race/assets/models/buildings/poly-new-AQQ2g0YE2D.glb',
  '/spelling-race/assets/models/buildings/poly-new-6BGhNQlUzRR.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-01lqee-dZAr.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-1BFCYNej8YT.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-4o0bLgk8mhD.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-5mOW8KZSHtU.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-9JuFwnivP0.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-T3oyvK6VEU.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-imVkxz7oZD.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-6HDseo5Ucme.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-cnTMgkFoTS0.glb',
  '/spelling-race/assets/models/buildings/poly-batch3-dR-WwNbUOe_.glb',
] as const

type Owned = { materials: Set<THREE.Material>; geometries: Set<THREE.BufferGeometry> }

let cachedModels: THREE.Group[] | null = null
let loadingPromise: Promise<THREE.Group[]> | null = null

// The live race must reach its first usable frame without downloading the former
// skyscraper catalogue. Curated background models may opt in later; the default
// scene uses the lightweight procedural district fallback.
cachedModels = []
loadingPromise = Promise.resolve([])

export async function loadBuildingModels(): Promise<THREE.Group[]> {
  if (cachedModels) return cachedModels
  return loadingPromise!
}

export function getCachedBuildingModels(): THREE.Group[] | null {
  return cachedModels
}

/**
 * Clone a loaded building model for placement in the scene.
 * Optionally scales to a target height in world units.
 * @param widthScale Multiplier for X/Z scale after height normalisation (default 1.0).
 */
export function cloneBuildingModel(
  source: THREE.Group,
  owned: Owned,
  targetHeight?: number,
  widthScale = 1.0,
): THREE.Group {
  const clone = source.clone(true)
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const clonedMats = materials.map((mat) => {
      const c = mat.clone()
      owned.materials.add(c)
      return c
    })
    object.material = Array.isArray(object.material) ? clonedMats : clonedMats[0]
    object.receiveShadow = true
    object.castShadow = true
  })

  if (targetHeight !== undefined && targetHeight > 0) {
    const box = new THREE.Box3().setFromObject(clone)
    const currentHeight = box.max.y - box.min.y
    if (currentHeight > 0.001) {
      const s = targetHeight / currentHeight
      clone.scale.set(s * widthScale, s, s * widthScale)
    }
  }

  return clone
}

/**
 * Pick a building model deterministically based on a seed.
 */
export function pickBuildingModel(models: readonly THREE.Group[], seed: number): THREE.Group {
  return models[seed % models.length]
}
