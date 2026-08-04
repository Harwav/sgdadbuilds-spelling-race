import * as THREE from 'three'
import manifest from '../../../public/spelling-race/assets/manifest.json'
import type { AssetId, RouteCard, RouteId, TextureAssetId, WorldAssetId } from './types'

export type LoadedWorldAssets = {
  readonly routeId: RouteId
  readonly models: ReadonlyMap<AssetId, THREE.Group>
  readonly textures: ReadonlyMap<TextureAssetId, THREE.Texture>
  readonly missingOptional: readonly AssetId[]
}

export const REQUIRED_WORLD_TEXTURES = {
  diffuse: 'asphalt-diffuse',
  normal: 'asphalt-normal',
  roughness: 'asphalt-roughness',
} as const satisfies Readonly<Record<string, TextureAssetId>>

export const REQUIRED_WORLD_TEXTURE_IDS: readonly TextureAssetId[] = Object.values(REQUIRED_WORLD_TEXTURES)

export type AssetLoadError = {
  readonly assetId: WorldAssetId
  readonly message: string
  readonly retryable: true
}

export type AssetBackend = {
  loadModel(path: string): Promise<THREE.Group>
  loadTexture(path: string): Promise<THREE.Texture>
  disposeModel(model: THREE.Group, scope?: AssetDisposalScope): void
  disposeTexture(texture: THREE.Texture, scope?: AssetDisposalScope): void
}

export type AssetDisposalScope = {
  readonly models: Set<THREE.Group>
  readonly textures: Set<THREE.Texture>
  readonly geometries: Set<THREE.BufferGeometry>
  readonly materials: Set<THREE.Material>
  readonly images: Set<object>
}

export type WorldAssetCatalogue = {
  acquire(card: RouteCard): Promise<LoadedWorldAssets>
  release(routeId: RouteId): void
  retry(card: RouteCard): Promise<LoadedWorldAssets>
}

type ManifestModelEntry = {
  readonly id: AssetId
  readonly kind: 'model'
  readonly path: string
}

type ManifestTextureEntry = {
  readonly id: TextureAssetId
  readonly kind: 'texture'
  readonly path: string
}

type ManifestEntry = ManifestModelEntry | ManifestTextureEntry

type CacheRecord = {
  refs: number
  status: 'loading' | 'ready' | 'failed'
  promise: Promise<LoadedWorldAssets>
  value?: LoadedWorldAssets
}

const entries = manifest.assets as readonly ManifestEntry[]
const modelsById = new Map<AssetId, ManifestModelEntry>(
  entries.filter((entry): entry is ManifestModelEntry => entry.kind === 'model').map((entry) => [entry.id, entry]),
)
const texturesById = new Map<TextureAssetId, ManifestTextureEntry>(
  entries.filter((entry): entry is ManifestTextureEntry => entry.kind === 'texture').map((entry) => [entry.id, entry]),
)
const requiredTextureEntries = REQUIRED_WORLD_TEXTURE_IDS.map(textureEntry)

export function isCompleteWorldAssetBundle(
  card: RouteCard,
  assets: LoadedWorldAssets | null | undefined,
): assets is LoadedWorldAssets {
  if (!assets || assets.routeId !== card.id) return false
  return card.requiredAssets.every((assetId) => assets.models.has(assetId))
    && REQUIRED_WORLD_TEXTURE_IDS.every((textureId) => assets.textures.has(textureId))
}

export function createAssetDisposalScope(): AssetDisposalScope {
  return {
    models: new Set(),
    textures: new Set(),
    geometries: new Set(),
    materials: new Set(),
    images: new Set(),
  }
}

export function createAssetCatalogue(backend: AssetBackend): WorldAssetCatalogue {
  const records = new Map<RouteId, CacheRecord>()

  function acquire(card: RouteCard): Promise<LoadedWorldAssets> {
    const existing = records.get(card.id)
    if (existing) {
      existing.refs += 1
      return existing.promise
    }

    const record: CacheRecord = {
      refs: 1,
      status: 'loading',
      promise: Promise.resolve({} as LoadedWorldAssets),
    }
    record.promise = loadRouteAssets(card, backend).then(
      (value) => {
        record.status = 'ready'
        record.value = value
        if (record.refs === 0) {
          disposeBundle(value, backend)
          records.delete(card.id)
        }
        return value
      },
      (error) => {
        record.status = 'failed'
        if (record.refs === 0) records.delete(card.id)
        throw error
      },
    )
    records.set(card.id, record)
    return record.promise
  }

  function release(routeId: RouteId): void {
    const record = records.get(routeId)
    if (!record || record.refs === 0) return

    record.refs -= 1
    if (record.refs !== 0) return
    if (record.status === 'ready' && record.value) {
      disposeBundle(record.value, backend)
      records.delete(routeId)
    }
    if (record.status === 'failed') records.delete(routeId)
  }

  function retry(card: RouteCard): Promise<LoadedWorldAssets> {
    const record = records.get(card.id)
    if (record?.status === 'failed') records.delete(card.id)
    return acquire(card)
  }

  return { acquire, release, retry }
}

async function loadRouteAssets(card: RouteCard, backend: AssetBackend): Promise<LoadedWorldAssets> {
  const requiredIds = uniqueAssetIds(card.requiredAssets)
  const optionalIds = uniqueAssetIds(card.optionalAssets.filter((assetId) => !requiredIds.has(assetId)))
  const requiredEntries = [...requiredIds].map(modelEntry)
  const optionalEntries = [...optionalIds].map(modelEntry)

  const requiredModels = requiredEntries.map((entry) => safelyLoad(() => backend.loadModel(entry.path)))
  const optionalModels = optionalEntries.map((entry) => safelyLoad(() => backend.loadModel(entry.path)))
  const textures = requiredTextureEntries.map((entry) => safelyLoad(() => backend.loadTexture(entry.path)))
  const [requiredResults, optionalResults, textureResults] = await Promise.all([
    Promise.allSettled(requiredModels),
    Promise.allSettled(optionalModels),
    Promise.allSettled(textures),
  ])

  const requiredFailure = requiredResults.find((result) => result.status === 'rejected')
  const textureFailure = textureResults.find((result) => result.status === 'rejected')
  if (requiredFailure || textureFailure) {
    disposeSettledAssets(requiredResults, optionalResults, textureResults, backend)
    const index = requiredFailure ? requiredResults.indexOf(requiredFailure) : textureResults.indexOf(textureFailure!)
    const id = requiredFailure ? requiredEntries[index].id : requiredTextureEntries[index].id
    const reason = requiredFailure ? requiredFailure.reason : textureFailure!.reason
    throw assetLoadError(id, reason)
  }

  const models = new Map<AssetId, THREE.Group>()
  requiredResults.forEach((result, index) => {
    if (result.status === 'fulfilled') models.set(requiredEntries[index].id, result.value)
  })

  const missingOptional: AssetId[] = []
  optionalResults.forEach((result, index) => {
    const assetId = optionalEntries[index].id
    if (result.status === 'fulfilled') models.set(assetId, result.value)
    else missingOptional.push(assetId)
  })

  const loadedTextures = new Map<TextureAssetId, THREE.Texture>()
  textureResults.forEach((result, index) => {
    if (result.status === 'fulfilled') loadedTextures.set(requiredTextureEntries[index].id, result.value)
  })

  return { routeId: card.id, models, textures: loadedTextures, missingOptional }
}

function modelEntry(assetId: AssetId): ManifestModelEntry {
  const entry = modelsById.get(assetId)
  if (!entry) throw new Error(`Model asset missing from manifest: ${assetId}`)
  return entry
}

function textureEntry(assetId: TextureAssetId): ManifestTextureEntry {
  const entry = texturesById.get(assetId)
  if (!entry) throw new Error(`Texture asset missing from manifest: ${assetId}`)
  return entry
}

function uniqueAssetIds(assetIds: readonly AssetId[]): Set<AssetId> {
  return new Set(assetIds)
}

function safelyLoad<T>(load: () => Promise<T>): Promise<T> {
  return Promise.resolve().then(load)
}

function assetLoadError(assetId: WorldAssetId, reason: unknown): AssetLoadError {
  return {
    assetId,
    message: reason instanceof Error ? reason.message : String(reason),
    retryable: true,
  }
}

function disposeSettledAssets(
  modelResults: readonly PromiseSettledResult<THREE.Group>[],
  optionalResults: readonly PromiseSettledResult<THREE.Group>[],
  textureResults: readonly PromiseSettledResult<THREE.Texture>[],
  backend: AssetBackend,
): void {
  const models = [...modelResults, ...optionalResults]
    .filter((result): result is PromiseFulfilledResult<THREE.Group> => result.status === 'fulfilled')
    .map((result) => result.value)
  const textures = textureResults
    .filter((result): result is PromiseFulfilledResult<THREE.Texture> => result.status === 'fulfilled')
    .map((result) => result.value)
  disposeAssets(models, textures, backend)
}

function disposeBundle(bundle: LoadedWorldAssets, backend: AssetBackend): void {
  disposeAssets(bundle.models.values(), bundle.textures.values(), backend)
}

function disposeAssets(
  models: Iterable<THREE.Group>,
  textures: Iterable<THREE.Texture>,
  backend: AssetBackend,
): void {
  const scope = createAssetDisposalScope()
  disposeUnique(models, (model) => backend.disposeModel(model, scope))
  disposeUnique(textures, (texture) => backend.disposeTexture(texture, scope))
}

function disposeUnique<T>(assets: Iterable<T>, dispose: (asset: T) => void): void {
  const disposed = new Set<T>()
  for (const asset of assets) {
    if (disposed.has(asset)) continue
    disposed.add(asset)
    dispose(asset)
  }
}
