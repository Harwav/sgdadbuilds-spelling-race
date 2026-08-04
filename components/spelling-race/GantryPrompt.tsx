'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'

export type GantryPromptHandle = { element: HTMLDivElement }

type GantryPromptProps = {
  activeWord: string | null
  turboRatio: number
}

const GantryPrompt = forwardRef<GantryPromptHandle, GantryPromptProps>(function GantryPrompt(
  { activeWord, turboRatio },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null)
  const displayedTurbo = clamp01(turboRatio)

  useImperativeHandle(ref, () => {
    const element = elementRef.current
    if (!element) throw new Error('Gantry prompt element is unavailable')
    return { element }
  }, [])

  return (
    <div
      ref={elementRef}
      aria-live="polite"
      className="pointer-events-none invisible absolute left-0 top-0 z-10 w-[min(68vw,680px)] rounded-xl border px-5 py-3 text-center shadow-lg"
      style={{
        background: 'var(--grand-prix-gantry)',
        borderColor: 'var(--grand-prix-kart-stripe)',
        color: 'var(--grand-prix-kart-stripe)',
      }}
    >
      <p data-testid="active-word" className="text-4xl font-bold lowercase tracking-wide sm:text-6xl">
        {activeWord?.toLocaleLowerCase() ?? '\u00a0'}
      </p>
      <div
        aria-label="Turbo remaining"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(displayedTurbo * 100)}
        className="mt-2 h-3 overflow-hidden rounded-full border"
        role="progressbar"
        style={{ borderColor: 'var(--grand-prix-kart-stripe)', background: 'var(--grand-prix-shadow)' }}
      >
        <span
          aria-hidden="true"
          className="block h-full origin-left rounded-full transition-[width] duration-100"
          style={{
            background: 'linear-gradient(90deg, var(--grand-prix-turbo-low), var(--grand-prix-turbo-high))',
            width: `${displayedTurbo * 100}%`,
          }}
        />
      </div>
    </div>
  )
})

export default GantryPrompt

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
