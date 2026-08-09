import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChangeCarScreen from '@/components/spelling-race/ChangeCarScreen'
import { carStore } from './carStore'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  carStore.cancelUnlock()
  delete window.__spellingRaceVoice
  document.body.replaceChildren()
})

describe('ChangeCarScreen', () => {
  it('ignores a late accepted speech result after cancelling an unlock challenge', async () => {
    let deliverResult!: (value: string) => void
    const abort = vi.fn()
    window.__spellingRaceVoice = {
      start: (onResult) => { deliverResult = onResult },
      abort,
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<ChangeCarScreen onBack={() => {}} />))
    await act(async () => (button(container, '🔒 Unlock')).click())
    const word = container.querySelector('p.text-5xl')?.textContent
    if (!word) throw new Error('challenge word was not rendered')
    await act(async () => (button(container, '🎤 Tap mic, then say it')).click())
    await act(async () => (button(container, 'Cancel challenge')).click())
    await act(async () => deliverResult(word))

    expect(abort).toHaveBeenCalledOnce()
    expect(carStore.read()).toMatchObject({ activeCar: null, unlockProgress: 0 })

    await act(async () => root.unmount())
  })
})

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((element) => element.textContent === text)
  if (!match) throw new Error(`button not found: ${text}`)
  return match as HTMLButtonElement
}
