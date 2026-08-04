import * as THREE from 'three'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import { routeTransform } from '@/lib/spelling-race/world/placement'
import { createRouteCurve } from '@/lib/spelling-race/world/routes'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import type { QualityTier } from '@/lib/spelling-race/world/quality'
import type { DistrictWorld } from '.'

export function createFixtureDistrict(
  card: RouteCard,
  assets: LoadedWorldAssets,
): DistrictWorld {
  const root = new THREE.Group()
  root.name = 'district-fixture'
  const curve = createRouteCurve(card)
  const landmarks: Array<{ root: THREE.Group; detailTier: 'near' | 'middle' | 'distant'; required: boolean }> = []
  const materials = new Set<THREE.Material>()
  let disposed = false

  try {
    card.landmarks.forEach((placement) => {
      if (placement.assetId !== 'fixture-block') {
        throw new Error(`Fixture district cannot create asset: ${placement.assetId}`)
      }
      const template = assets.models.get('fixture-block')
      if (!template) throw new Error('Loaded world model missing: fixture-block')
      const model = template.clone(true)
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => ownMaterial(material.clone(), materials))
          : ownMaterial(object.material.clone(), materials)
        object.receiveShadow = true
      })

      const landmarkRoot = new THREE.Group()
      landmarkRoot.name = `landmark-${placement.id}`
      landmarkRoot.userData.landmarkId = placement.id
      landmarkRoot.userData.assetId = placement.assetId
      landmarkRoot.userData.detailTier = placement.detailTier
      landmarkRoot.userData.required = placement.required
      landmarkRoot.applyMatrix4(routeTransform(curve, placement))
      landmarkRoot.add(model)
      root.add(landmarkRoot)
      landmarks.push({ root: landmarkRoot, detailTier: placement.detailTier, required: placement.required })
    })
  } catch (error) {
    disposeOwned(root, materials)
    throw error
  }

  const setQuality = (tier: QualityTier) => {
    root.userData.qualityTier = tier
    landmarks.forEach((landmark) => {
      landmark.root.visible = tier === 'high'
        || (landmark.detailTier !== 'distant' && (tier === 'balanced' || landmark.detailTier === 'near' || landmark.required))
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
      disposeOwned(root, materials)
    },
  }
}

function ownMaterial<T extends THREE.Material>(material: T, materials: Set<THREE.Material>): T {
  materials.add(material)
  return material
}

function disposeOwned(root: THREE.Group, materials: Set<THREE.Material>): void {
  root.clear()
  materials.forEach((material) => material.dispose())
  materials.clear()
}
