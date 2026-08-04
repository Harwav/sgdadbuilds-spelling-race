import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  createAssetCatalogue,
  createAssetDisposalScope,
  type AssetBackend,
  type AssetDisposalScope,
} from '@/lib/spelling-race/world/assets'

export function createBrowserAssetBackend(): AssetBackend {
  const gltfLoader = new GLTFLoader()
  const textureLoader = new THREE.TextureLoader()

  return {
    async loadModel(path) {
      throwDevelopmentAssetFailure(path)
      const gltf = await gltfLoader.loadAsync(path)
      return gltf.scene.clone(true)
    },
    async loadTexture(path) {
      throwDevelopmentAssetFailure(path)
      const texture = await textureLoader.loadAsync(path)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      if (path.includes('diffuse')) texture.colorSpace = THREE.SRGBColorSpace
      return texture
    },
    disposeModel(root, scope = createAssetDisposalScope()) {
      if (scope.models.has(root)) return
      scope.models.add(root)

      root.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry && !scope.geometries.has(mesh.geometry)) {
          scope.geometries.add(mesh.geometry)
          mesh.geometry.dispose()
        }
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        meshMaterials.filter(Boolean).forEach((material) => {
          if (scope.materials.has(material)) return
          scope.materials.add(material)
          material.dispose()
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) disposeTexture(value, scope)
          })
        })
      })
    },
    disposeTexture(texture, scope = createAssetDisposalScope()) {
      disposeTexture(texture, scope)
    },
  }
}

function throwDevelopmentAssetFailure(path: string): void {
  if (process.env.NODE_ENV === 'production') return
  const failedId = window.__tinyGrandPrixTest?.failAssetId
  const filename = path.split('/').at(-1)?.replace(/\.(?:glb|webp)$/, '')
  if (failedId && filename === failedId) throw new Error(`Development asset failure: ${failedId}`)
}

export const browserWorldAssets = createAssetCatalogue(createBrowserAssetBackend())

function disposeTexture(texture: THREE.Texture, scope: AssetDisposalScope): void {
  if (scope.textures.has(texture)) return
  scope.textures.add(texture)
  const image = texture.source.data as { close?: () => void } | undefined
  if (image && typeof image === 'object' && !scope.images.has(image)) {
    scope.images.add(image)
    image.close?.()
  }
  texture.dispose()
}
