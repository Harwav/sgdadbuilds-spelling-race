import type { LoadedWorldAssets, WorldAssetCatalogue } from './assets'
import type { RouteCard } from './types'

export type WorldAssetState =
  | { status: 'loading'; attemptKey: number }
  | { status: 'ready'; attemptKey: number; assets: LoadedWorldAssets }
  | { status: 'error'; attemptKey: number }

export type PageWorldAssetLease = {
  start(): void
  retry(): void
  release(): void
}

type PageWorldAssetLeaseOptions = {
  readonly catalogue: WorldAssetCatalogue
  readonly route: RouteCard
  readonly onState: (state: WorldAssetState) => void
  readonly publishDiagnostics: (assets: LoadedWorldAssets) => void
  readonly clearDiagnostics: () => void
}

export function createPageWorldAssetLease({
  catalogue,
  route,
  onState,
  publishDiagnostics,
  clearDiagnostics,
}: PageWorldAssetLeaseOptions): PageWorldAssetLease {
  let released = false
  let started = false
  let state: WorldAssetState = { status: 'loading', attemptKey: 0 }

  const publishState = (next: WorldAssetState) => {
    if (released) return
    state = next
    onState(next)
  }

  const settle = (promise: Promise<LoadedWorldAssets>, attemptKey: number) => {
    void promise.then((assets) => {
      if (released || state.attemptKey !== attemptKey) return
      publishDiagnostics(assets)
      publishState({ status: 'ready', attemptKey, assets })
    }).catch(() => {
      if (released || state.attemptKey !== attemptKey) return
      clearDiagnostics()
      publishState({ status: 'error', attemptKey })
    })
  }

  return {
    start() {
      if (started || released) return
      started = true
      publishState(state)
      settle(catalogue.acquire(route), state.attemptKey)
    },
    retry() {
      if (released || state.status !== 'error') return
      const attemptKey = state.attemptKey + 1
      publishState({ status: 'loading', attemptKey })
      settle(catalogue.retry(route), attemptKey)
    },
    release() {
      if (released) return
      released = true
      clearDiagnostics()
      catalogue.release(route.id)
    },
  }
}
