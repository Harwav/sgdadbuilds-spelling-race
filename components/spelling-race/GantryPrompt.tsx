'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'

export type GantryPromptHandle = { element: HTMLDivElement }

type GantryPromptProps = {
  activeWord: string | null
}

const GantryPrompt = forwardRef<GantryPromptHandle, GantryPromptProps>(function GantryPrompt(
  { activeWord },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null)

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
    </div>
  )
})

export default GantryPrompt
