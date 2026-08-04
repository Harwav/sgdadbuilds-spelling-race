import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createBrowserAssetBackend } from '@/components/spelling-race/world/loaders'
import { createAssetCatalogue } from './assets'
import { FIXTURE_HARBOUR_ROUTE } from './routes'

describe('browser world asset disposal', () => {
  it('releases shared geometry, material, map, and bitmap once across the whole bundle', async () => {
    const geometry = new THREE.BufferGeometry()
    const texture = new THREE.Texture()
    const image = { close: vi.fn() }
    texture.source.data = image
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const firstRoot = new THREE.Group().add(new THREE.Mesh(geometry, material))
    const secondRoot = new THREE.Group().add(new THREE.Mesh(geometry, material))
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')
    const browserBackend = createBrowserAssetBackend()
    const catalogue = createAssetCatalogue({
      ...browserBackend,
      loadModel: async (path) => path.endsWith('fixture-block.glb') ? firstRoot : secondRoot,
      loadTexture: async () => texture,
    })

    await catalogue.acquire({
      ...FIXTURE_HARBOUR_ROUTE,
      requiredAssets: ['fixture-block', 'kart'],
    })
    catalogue.release('fixture-harbour')

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
    expect(textureDispose).toHaveBeenCalledTimes(1)
    expect(image.close).toHaveBeenCalledTimes(1)
  })
})
