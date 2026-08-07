'use client'

import type { Difficulty, KartColour } from '@/lib/spelling-race/types'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import GarageScene from './GarageScene'

type RaceSetupProps = {
  difficulty: Difficulty
  kartColour: KartColour
  routeLabel: string
  assetStatus: 'loading' | 'ready' | 'error'
  assets: LoadedWorldAssets | null
  assetRecoveryDismissed: boolean
  skippedWordCount: number
  onDifficultyChange(value: Difficulty): void
  onKartColourChange(value: KartColour): void
  onStart(): void
  onRefit(): void
  onChangeCar(): void
  onRetryAssets(): void
  onBackFromAssetError(): void
}

const DIFFICULTIES: readonly { value: Difficulty; label: string; detail: string }[] = [
  { value: 'rookie', label: 'Rookie', detail: 'Early sight words' },
  { value: 'racer', label: 'Racer', detail: 'First and second grade' },
  { value: 'champion', label: 'Champion', detail: 'Third-grade challenge' },
]

const KARTS: readonly { value: KartColour; label: string }[] = [
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'teal', label: 'Teal' },
  { value: 'purple', label: 'Purple' },
]

export default function RaceSetup({
  difficulty,
  kartColour,
  routeLabel,
  assetStatus,
  assets,
  assetRecoveryDismissed,
  skippedWordCount,
  onDifficultyChange,
  onKartColourChange,
  onStart,
  onRefit,
  onChangeCar,
  onRetryAssets,
  onBackFromAssetError,
}: RaceSetupProps) {
  if (assetStatus === 'error' && !assetRecoveryDismissed) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border p-6 text-center sm:p-8" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>{routeLabel}</p>
        <h2 className="mt-2 text-2xl font-bold">The track could not finish loading</h2>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Nothing has started yet. A grown-up can try the track again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetryAssets} className="min-h-12 rounded-full px-6 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Try again</button>
          <button type="button" onClick={onBackFromAssetError} className="min-h-12 rounded-full border px-6 font-bold" style={{ background: 'var(--surface-1)', borderColor: 'var(--line-strong)', color: 'var(--text-primary)' }}>Back</button>
        </div>
      </section>
    )
  }

  const ready = assetStatus === 'ready' && assets !== null
  return (
    <section className="mx-auto max-w-5xl rounded-xl border p-5 sm:p-7" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      <div className="grid items-center gap-6 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Choose your racer</p>
          <h2 className="mt-1 text-2xl font-bold">Your kart is already on the grid.</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Tap a colour and watch your own car change immediately.</p>
          <div className="mt-4">
            {ready ? (
              <GarageScene colour={kartColour} assets={assets} />
            ) : (
              <div className="grid min-h-56 place-items-center rounded-xl border px-4 text-center text-sm font-semibold" style={{ background: 'var(--grand-prix-gantry)', borderColor: 'var(--line)', color: 'var(--text-secondary)' }}>
                The garage is waiting for {routeLabel}.
              </div>
            )}
          </div>
          <fieldset className="mt-4">
            <legend className="sr-only">Choose your kart colour</legend>
            <div className="grid grid-cols-4 gap-2">
              {KARTS.map((kart) => (
                <label key={kart.value} className="relative cursor-pointer rounded-xl border p-2 text-center" style={{ borderColor: kartColour === kart.value ? 'var(--brand-yellow)' : 'var(--line-strong)', background: kartColour === kart.value ? 'var(--fill-ghost)' : 'transparent' }}>
                  <input
                    type="radio"
                    name="kart"
                    value={kart.value}
                    aria-label={`${kart.label} kart`}
                    checked={kartColour === kart.value}
                    onChange={() => onKartColourChange(kart.value)}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <span aria-hidden="true" className="pointer-events-none mx-auto block h-7 w-7 rounded-full border-4" style={{ background: `var(--grand-prix-kart-${kart.value})`, borderColor: 'var(--grand-prix-kart-stripe)' }} />
                  <span className="mt-1 block text-xs font-bold">{kart.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="text-lg font-bold">Pick the word pack</legend>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>The race stays the same. Only the words get tougher.</p>
          <div className="mt-3 grid gap-3">
          {DIFFICULTIES.map((option) => (
            <label key={option.value} className="cursor-pointer rounded-xl border p-4" style={{ borderColor: difficulty === option.value ? 'var(--brand-yellow)' : 'var(--line-strong)', background: 'var(--fill-ghost)' }}>
              <input
                type="radio"
                name="difficulty"
                value={option.value}
                checked={difficulty === option.value}
                onChange={() => onDifficultyChange(option.value)}
                className="mr-2 accent-[var(--brand-yellow)]"
              />
              <span className="font-bold">{option.label}</span>
              <span className="mt-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{option.detail}</span>
            </label>
          ))}
          </div>
          {assetStatus === 'error' && (
            <div className="mt-4 rounded-lg border p-3 text-sm" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>The track is still waiting for its parts.</p>
              <button type="button" onClick={onRetryAssets} className="mt-2 min-h-11 rounded-full border px-4 font-bold" style={{ borderColor: 'var(--brand-yellow)', color: 'var(--brand-yellow)' }}>Try again</button>
            </div>
          )}
          <button type="button" onClick={onRefit} className="mt-4 min-h-12 w-full rounded-full border px-6 text-sm font-bold" style={{ borderColor: 'var(--brand-yellow)', color: 'var(--brand-yellow)' }}>
            🔧 Refit{skippedWordCount > 0 ? ` (${skippedWordCount})` : ''}
          </button>
          <button type="button" onClick={onChangeCar} className="mt-3 min-h-12 w-full rounded-full border px-6 text-sm font-bold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-primary)' }}>
            🚗 Change
          </button>
          <button type="button" onClick={onStart} disabled={!ready} className="mt-3 min-h-12 w-full rounded-full px-6 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>
            {assetStatus === 'loading' ? `Loading ${routeLabel}…` : 'Start engines'}
          </button>
        </fieldset>
      </div>
    </section>
  )
}
