import * as THREE from 'three'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createAssetCatalogue, type AssetBackend, type AssetLoadError } from './assets'
import { FIXTURE_HARBOUR_ROUTE } from './routes'
import type { AssetId, RouteCard, WorldAssetId } from './types'

type Deferred<T> = {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function route(overrides: Partial<RouteCard> = {}): RouteCard {
  return {
    ...FIXTURE_HARBOUR_ROUTE,
    requiredAssets: ['fixture-block'],
    optionalAssets: [],
    ...overrides,
  }
}

function backend(overrides: Partial<AssetBackend> = {}) {
  const loadedModels: string[] = []
  const loadedTextures: string[] = []
  const disposedModels: THREE.Group[] = []
  const disposedTextures: THREE.Texture[] = []
  const assetBackend: AssetBackend = {
    loadModel: async (path) => {
      loadedModels.push(path)
      return new THREE.Group()
    },
    loadTexture: async (path) => {
      loadedTextures.push(path)
      return new THREE.Texture()
    },
    disposeModel: (model) => { disposedModels.push(model) },
    disposeTexture: (texture) => { disposedTextures.push(texture) },
    ...overrides,
  }
  return { assetBackend, loadedModels, loadedTextures, disposedModels, disposedTextures }
}

describe('world asset catalogue', () => {
  it('types load-error asset IDs for both models and textures', () => {
    expectTypeOf<AssetLoadError['assetId']>().toEqualTypeOf<WorldAssetId>()
  })

  it('shares one in-flight route load between callers', async () => {
    const fixture = backend()
    const model = deferred<THREE.Group>()
    fixture.assetBackend.loadModel = async (path) => {
      fixture.loadedModels.push(path)
      return model.promise
    }
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    const first = catalogue.acquire(route())
    const second = catalogue.acquire(route())
    await Promise.resolve()

    expect(fixture.loadedModels).toEqual(['/spelling-race/assets/models/fixture-block.glb'])
    model.resolve(new THREE.Group())
    const [firstBundle, secondBundle] = await Promise.all([first, second])

    expect(secondBundle).toBe(firstBundle)
  })

  it('rejects a required model failure with that asset id', async () => {
    const fixture = backend({
      loadModel: async () => { throw new Error('network unavailable') },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await expect(catalogue.acquire(route())).rejects.toMatchObject({
      assetId: 'fixture-block',
      message: 'network unavailable',
      retryable: true,
    })
  })

  it('rejects a required texture failure with its exact texture id', async () => {
    const fixture = backend({
      loadTexture: async (path) => {
        if (path.endsWith('asphalt-normal.webp')) throw new Error('texture unavailable')
        return new THREE.Texture()
      },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await expect(catalogue.acquire(route())).rejects.toMatchObject({
      assetId: 'asphalt-normal',
      message: 'texture unavailable',
      retryable: true,
    })
  })

  it('disposes other fulfilled assets when a required model fails', async () => {
    const fulfilledModel = new THREE.Group()
    const fixture = backend({
      loadModel: async (path) => {
        if (path.endsWith('fixture-block.glb')) throw new Error('required model missing')
        return fulfilledModel
      },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await expect(catalogue.acquire(route({ requiredAssets: ['fixture-block', 'kart'] }))).rejects.toMatchObject({
      assetId: 'fixture-block',
    })

    expect(fixture.disposedModels).toEqual([fulfilledModel])
    expect(fixture.disposedTextures).toHaveLength(3)
  })

  it('keeps an optional model failure out of the bundle and records it', async () => {
    const fixture = backend({
      loadModel: async (path) => {
        if (path.endsWith('street-lamp.glb')) throw new Error('optional model missing')
        return new THREE.Group()
      },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    const bundle = await catalogue.acquire(route({ optionalAssets: ['street-lamp'] }))

    expect(bundle.models.has('street-lamp')).toBe(false)
    expect(bundle.missingOptional).toEqual(['street-lamp'])
  })

  it('does not request procedural-only optional landmark models', async () => {
    const fixture = backend()
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    const bundle = await catalogue.acquire(route({ optionalAssets: ['supertree'] }))

    expect(fixture.loadedModels).toEqual(['/spelling-race/assets/models/fixture-block.glb'])
    expect(bundle.models.has('supertree')).toBe(false)
    expect(bundle.missingOptional).toEqual(['supertree'])
  })

  it('starts a fresh request only when retrying a failed route', async () => {
    let attempts = 0
    const fixture = backend({
      loadModel: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('transient outage')
        return new THREE.Group()
      },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await expect(catalogue.acquire(route())).rejects.toMatchObject({ assetId: 'fixture-block' })
    await expect(catalogue.acquire(route())).rejects.toMatchObject({ assetId: 'fixture-block' })
    expect(attempts).toBe(1)

    const bundle = await catalogue.retry(route())

    expect(attempts).toBe(2)
    expect(bundle.models.get('fixture-block')).toBeInstanceOf(THREE.Group)
  })

  it('releases a successful retry exactly once through its original page lease', async () => {
    let attempts = 0
    const retriedModel = new THREE.Group()
    const fixture = backend({
      loadModel: async () => {
        attempts += 1
        if (attempts === 1) throw new Error('transient outage')
        return retriedModel
      },
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await expect(catalogue.acquire(route())).rejects.toMatchObject({ assetId: 'fixture-block' })
    await catalogue.retry(route())
    catalogue.release('fixture-harbour')
    catalogue.release('fixture-harbour')

    expect(fixture.disposedModels).toEqual([retriedModel])
  })

  it('retains a shared ready bundle until its final release', async () => {
    const fixture = backend()
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await Promise.all([catalogue.acquire(route()), catalogue.acquire(route())])
    catalogue.release('fixture-harbour')

    expect(fixture.disposedModels).toEqual([])
    expect(fixture.disposedTextures).toEqual([])
    catalogue.release('fixture-harbour')

    expect(fixture.disposedModels).toHaveLength(1)
    expect(fixture.disposedTextures).toHaveLength(3)
  })

  it('disposes each unique loaded model and texture once on the final release', async () => {
    const sharedModel = new THREE.Group()
    const sharedTexture = new THREE.Texture()
    const fixture = backend({
      loadModel: async () => sharedModel,
      loadTexture: async () => sharedTexture,
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)

    await catalogue.acquire(route({ requiredAssets: ['fixture-block', 'kart'] as AssetId[] }))
    catalogue.release('fixture-harbour')

    expect(fixture.disposedModels).toEqual([sharedModel])
    expect(fixture.disposedTextures).toEqual([sharedTexture])
  })

  it('waits for optional models before resolving so none can arrive after the bundle', async () => {
    const optionalModel = deferred<THREE.Group>()
    const fixture = backend({
      loadModel: async (path) => path.endsWith('street-lamp.glb') ? optionalModel.promise : new THREE.Group(),
    })
    const catalogue = createAssetCatalogue(fixture.assetBackend)
    let resolved = false

    const loading = catalogue.acquire(route({ optionalAssets: ['street-lamp'] })).then((bundle) => {
      resolved = true
      return bundle
    })
    await Promise.resolve()

    expect(resolved).toBe(false)
    optionalModel.resolve(new THREE.Group())
    const bundle = await loading

    expect(bundle.models.get('street-lamp')).toBeInstanceOf(THREE.Group)
    await Promise.resolve()
    expect(bundle.models.size).toBe(2)
  })
})
