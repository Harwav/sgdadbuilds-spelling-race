import * as THREE from 'three'
import { REQUIRED_WORLD_TEXTURES, type LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import type { TextureAssetId } from '@/lib/spelling-race/world/types'
import type { GrandPrixPalette } from '../kartModel'

export type WorldMaterials = {
  readonly grass: THREE.MeshStandardMaterial
  readonly grassShadow: THREE.MeshStandardMaterial
  readonly asphalt: THREE.MeshStandardMaterial
  readonly kerbRed: THREE.MeshStandardMaterial
  readonly kerbWhite: THREE.MeshStandardMaterial
  readonly barrierTeal: THREE.MeshStandardMaterial
  readonly barrierYellow: THREE.MeshStandardMaterial
  readonly roadMarking: THREE.MeshStandardMaterial
  readonly grandstand: THREE.MeshStandardMaterial
  readonly grandstandCanopy: THREE.MeshStandardMaterial
  readonly grandstandSeats: readonly THREE.MeshStandardMaterial[]
  readonly treeTrunk: THREE.MeshStandardMaterial
  readonly treeCanopy: THREE.MeshStandardMaterial
  readonly gantryFrame: THREE.MeshStandardMaterial
  readonly gantryPost: THREE.MeshStandardMaterial
  readonly gantryCap: THREE.MeshStandardMaterial
  readonly speedStreak: THREE.LineBasicMaterial
  readonly boostParticle: THREE.MeshBasicMaterial
}

export function createWorldMaterials(palette: GrandPrixPalette, assets: LoadedWorldAssets): WorldMaterials {
  const diffuse = repeatingTexture(assets, REQUIRED_WORLD_TEXTURES.diffuse)
  const normal = repeatingTexture(assets, REQUIRED_WORLD_TEXTURES.normal)
  const roughness = repeatingTexture(assets, REQUIRED_WORLD_TEXTURES.roughness)

  return {
    grass: standard(palette.grass, 0.92),
    grassShadow: standard(palette.grassShadow, 0.95),
    asphalt: new THREE.MeshStandardMaterial({
      color: palette.asphalt,
      map: diffuse,
      normalMap: normal,
      roughnessMap: roughness,
      roughness: 0.86,
      metalness: 0.02,
    }),
    kerbRed: standard(palette.kerbRed, 0.76),
    kerbWhite: standard(palette.kerbWhite, 0.76),
    barrierTeal: standard(palette.barrierTeal, 0.7),
    barrierYellow: standard(palette.barrierYellow, 0.7),
    roadMarking: standard(palette.roadMarking, 0.74),
    grandstand: standard(palette.gantry, 0.72),
    grandstandCanopy: standard(palette.barrierYellow, 0.46, 0.08),
    grandstandSeats: [
      standard(palette.kart.red, 0.65),
      standard(palette.kart.teal, 0.65),
      standard(palette.kart.purple, 0.65),
    ],
    treeTrunk: standard(palette.treeTrunk, 0.95),
    treeCanopy: standard(palette.treeCanopy, 0.8),
    gantryFrame: standard(palette.gantry, 0.58, 0.12),
    gantryPost: standard(palette.gantryPost, 0.5, 0.08),
    gantryCap: standard(palette.barrierYellow, 0.5),
    speedStreak: new THREE.LineBasicMaterial({
      color: palette.kartStripe,
      transparent: true,
      opacity: 0.35,
    }),
    boostParticle: new THREE.MeshBasicMaterial({
      color: palette.barrierYellow,
      transparent: true,
      opacity: 0.82,
    }),
  }
}

function repeatingTexture(assets: LoadedWorldAssets, id: TextureAssetId): THREE.Texture {
  const texture = assets.textures.get(id)
  if (!texture) throw new Error(`Loaded world texture missing: ${id}`)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function standard(colour: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colour, roughness, metalness })
}
