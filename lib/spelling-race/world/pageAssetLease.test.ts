import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createAssetCatalogue, type AssetBackend } from './assets'
import { createPageWorldAssetLease, type WorldAssetState } from './pageAssetLease'
import { FIXTURE_HARBOUR_ROUTE } from './routes'

type Deferred<T> = {
  readonly promise: Promise<T>
  resolve(value: T): void
}

describe('page world-asset lease lifecycle', () => {
  it('publishes nothing after a delayed initial acquire is released and disposes late success once', async () => {
    const model = deferred<THREE.Group>()
    const texture = deferred<THREE.Texture>()
    const disposedModels: THREE.Group[] = []
    const disposedTextures: THREE.Texture[] = []
    const catalogue = createAssetCatalogue(backend({
      loadModel: async () => model.promise,
      loadTexture: async () => texture.promise,
      disposeModel: (value) => { disposedModels.push(value) },
      disposeTexture: (value) => { disposedTextures.push(value) },
    }))
    const states: WorldAssetState[] = []
    const publishDiagnostics = vi.fn()
    const clearDiagnostics = vi.fn()
    const lease = createPageWorldAssetLease({
      catalogue,
      route: FIXTURE_HARBOUR_ROUTE,
      onState: (state) => { states.push(state) },
      publishDiagnostics,
      clearDiagnostics,
    })

    lease.start()
    await Promise.resolve()
    lease.release()
    const stateCountAtUnmount = states.length
    const loadedModel = new THREE.Group()
    const loadedTexture = new THREE.Texture()
    model.resolve(loadedModel)
    texture.resolve(loadedTexture)

    await vi.waitFor(() => expect(disposedModels).toEqual([loadedModel]))
    expect(disposedTextures).toEqual([loadedTexture])
    expect(states).toHaveLength(stateCountAtUnmount)
    expect(states.map((state) => state.status)).toEqual(['loading'])
    expect(publishDiagnostics).not.toHaveBeenCalled()
    expect(clearDiagnostics).toHaveBeenCalledTimes(1)
  })

  it('publishes nothing after a delayed retry is released and disposes late retry success once', async () => {
    const retryModel = deferred<THREE.Group>()
    const retryTexture = deferred<THREE.Texture>()
    const initialTexture = new THREE.Texture()
    const disposedModels: THREE.Group[] = []
    const disposedTextures: THREE.Texture[] = []
    let attempt: 'initial' | 'retry' = 'initial'
    const catalogue = createAssetCatalogue(backend({
      loadModel: async () => {
        if (attempt === 'initial') throw new Error('initial failure')
        return retryModel.promise
      },
      loadTexture: async () => attempt === 'initial' ? initialTexture : retryTexture.promise,
      disposeModel: (value) => { disposedModels.push(value) },
      disposeTexture: (value) => { disposedTextures.push(value) },
    }))
    const states: WorldAssetState[] = []
    const publishDiagnostics = vi.fn()
    const lease = createPageWorldAssetLease({
      catalogue,
      route: FIXTURE_HARBOUR_ROUTE,
      onState: (state) => { states.push(state) },
      publishDiagnostics,
      clearDiagnostics: vi.fn(),
    })

    lease.start()
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe('error'))
    attempt = 'retry'
    lease.retry()
    expect(states.at(-1)).toMatchObject({ status: 'loading', attemptKey: 1 })
    lease.release()
    const stateCountAtUnmount = states.length
    const loadedModel = new THREE.Group()
    const loadedTexture = new THREE.Texture()
    retryModel.resolve(loadedModel)
    retryTexture.resolve(loadedTexture)

    await vi.waitFor(() => expect(disposedModels).toEqual([loadedModel]))
    expect(disposedTextures.filter((value) => value === loadedTexture)).toHaveLength(1)
    expect(states).toHaveLength(stateCountAtUnmount)
    expect(states.map((state) => state.status)).toEqual(['loading', 'error', 'loading'])
    expect(publishDiagnostics).not.toHaveBeenCalled()
  })
})

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function backend(overrides: Partial<AssetBackend>): AssetBackend {
  return {
    loadModel: async () => new THREE.Group(),
    loadTexture: async () => new THREE.Texture(),
    disposeModel: () => undefined,
    disposeTexture: () => undefined,
    ...overrides,
  }
}
