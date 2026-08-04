'use client'

import { useEffect, useRef, useState } from 'react'
import RaceFinish from '@/components/spelling-race/RaceFinish'
import RaceReadinessGate from '@/components/spelling-race/RaceReadinessGate'
import RaceScreen from '@/components/spelling-race/RaceScreen'
import RaceSetup from '@/components/spelling-race/RaceSetup'
import { browserWorldAssets } from '@/components/spelling-race/world/loaders'
import type { Difficulty, KartColour, RaceRecap, SteeringMode } from '@/lib/spelling-race/types'
import type { LoadedWorldAssets, WorldAssetCatalogue } from '@/lib/spelling-race/world/assets'
import {
  createPageWorldAssetLease,
  type PageWorldAssetLease,
  type WorldAssetState,
} from '@/lib/spelling-race/world/pageAssetLease'
import { SINGAPORE_HEARTLAND_ROUTE } from '@/lib/spelling-race/world/routes'
import type { RouteCard } from '@/lib/spelling-race/world/types'

type SpellingRaceScreen = 'setup' | 'readiness' | 'countdown' | 'race' | 'finished'
type SpellingRaceClientProps = {
  readonly assetCatalogue?: WorldAssetCatalogue
  readonly route?: RouteCard
}

export default function SpellingRaceClient({
  assetCatalogue = browserWorldAssets,
  route = SINGAPORE_HEARTLAND_ROUTE,
}: SpellingRaceClientProps = {}) {
  const [screen, setScreen] = useState<SpellingRaceScreen>('setup')
  const [difficulty, setDifficulty] = useState<Difficulty>('rookie')
  const [kartColour, setKartColour] = useState<KartColour>('red')
  const [steeringMode, setSteeringMode] = useState<SteeringMode>('touch')
  const [recap, setRecap] = useState<RaceRecap | null>(null)
  const [raceKey, setRaceKey] = useState(0)
  const [worldAssetState, setWorldAssetState] = useState<WorldAssetState>({ status: 'loading', attemptKey: 0 })
  const [assetRecoveryDismissed, setAssetRecoveryDismissed] = useState(false)
  const assetLeaseRef = useRef<PageWorldAssetLease | null>(null)

  useEffect(() => {
    const lease = createPageWorldAssetLease({
      catalogue: assetCatalogue,
      route,
      onState: (state) => {
        if (state.status === 'error') setAssetRecoveryDismissed(false)
        setWorldAssetState(state)
      },
      publishDiagnostics: publishAssetDiagnostics,
      clearDiagnostics: clearAssetDiagnostics,
    })
    assetLeaseRef.current = lease
    lease.start()

    return () => {
      if (assetLeaseRef.current === lease) assetLeaseRef.current = null
      lease.release()
    }
  }, [assetCatalogue, route])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const clearWhenDisabled = () => {
      if (new URLSearchParams(window.location.search).get('visual-debug') !== '1') clearAssetDiagnostics()
    }
    window.addEventListener('popstate', clearWhenDisabled)
    return () => window.removeEventListener('popstate', clearWhenDisabled)
  }, [])

  function lineUp(mode: SteeringMode) {
    if (worldAssetState.status !== 'ready') return
    setSteeringMode(mode)
    setRecap(null)
    setScreen('countdown')
  }

  function raceAgain() {
    setRecap(null)
    setRaceKey((value) => value + 1)
    setScreen('countdown')
  }

  function returnToSetup() {
    setRecap(null)
    setScreen('setup')
  }

  function startReadiness() {
    if (worldAssetState.status === 'ready') setScreen('readiness')
  }

  function retryWorldAssets() {
    if (worldAssetState.status !== 'error') return
    setAssetRecoveryDismissed(false)
    assetLeaseRef.current?.retry()
  }

  return (
    <main className="ui-font min-h-full px-3 py-4 sm:px-6" style={{ background: 'var(--brand-navy)', color: 'var(--text-primary)' }}>
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>SGDadBuilds experiment</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Tiny Grand Prix</h1>
          </div>
          <p className="max-w-xl text-sm" style={{ color: 'var(--text-secondary)' }}>Read sight words for turbo, steer through three laps, and race three visible rivals.</p>
        </header>

        {screen === 'setup' && (
          <RaceSetup
            difficulty={difficulty}
            kartColour={kartColour}
            routeLabel={route.label}
            assetStatus={worldAssetState.status}
            assets={worldAssetState.status === 'ready' ? worldAssetState.assets : null}
            assetRecoveryDismissed={assetRecoveryDismissed}
            onDifficultyChange={setDifficulty}
            onKartColourChange={setKartColour}
            onStart={startReadiness}
            onRetryAssets={retryWorldAssets}
            onBackFromAssetError={() => setAssetRecoveryDismissed(true)}
          />
        )}

        {screen === 'readiness' && <RaceReadinessGate onReady={lineUp} onBack={() => setScreen('setup')} />}

        {(screen === 'countdown' || screen === 'race') && worldAssetState.status === 'ready' && (
          <RaceScreen
            key={raceKey}
            difficulty={difficulty}
            kartColour={kartColour}
            steeringMode={steeringMode}
            route={route}
            assets={worldAssetState.assets}
            onFinished={(result) => { setRecap(result); setScreen('finished') }}
            onExit={returnToSetup}
          />
        )}

        {screen === 'finished' && recap && <RaceFinish recap={recap} onRaceAgain={raceAgain} onChangeSetup={returnToSetup} />}
      </div>
    </main>
  )
}

function publishAssetDiagnostics(assets: LoadedWorldAssets): void {
  if (process.env.NODE_ENV === 'production') return
  if (new URLSearchParams(window.location.search).get('visual-debug') !== '1') return
  window.__tinyGrandPrixAssetDiagnostics = {
    routeId: assets.routeId,
    missingOptionalAssetIds: [...assets.missingOptional],
  }
}

function clearAssetDiagnostics(): void {
  if (process.env.NODE_ENV === 'production') return
  delete window.__tinyGrandPrixAssetDiagnostics
}
