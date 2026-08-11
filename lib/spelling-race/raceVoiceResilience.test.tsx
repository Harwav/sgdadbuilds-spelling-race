import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RaceScreen from '@/components/spelling-race/RaceScreen'
import type { LoadedWorldAssets } from './world/assets'
import type { RouteCard } from './world/types'

type VoiceSession = {
  result(value: readonly string[] | string): void
  error(code: string): void
  end(): void
}

const harness = vi.hoisted(() => ({
  sessions: [] as VoiceSession[],
  promptDone: null as null | (() => void),
  promptWord: null as string | null,
  promptCancelCount: 0,
}))

vi.mock('next/dynamic', () => ({
  default: () => function MockScene({ activeWord }: { activeWord: string | null }) {
    return <div data-testid="active-word">{activeWord ?? ''}</div>
  },
}))

vi.mock('@/lib/spelling-race/world/assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spelling-race/world/assets')>()
  return { ...actual, isCompleteWorldAssetBundle: () => true }
})

vi.mock('@/lib/spelling-race/raceAudio', () => ({
  createRaceAudio: () => ({
    unlock: async () => undefined,
    startRace: () => undefined,
    setEngine: () => undefined,
    boost: () => undefined,
    setSurface: () => undefined,
    lap: () => undefined,
    timeout: () => undefined,
    finish: () => undefined,
    duck: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    setMuted: () => undefined,
    destroy: () => undefined,
  }),
}))

vi.mock('@/lib/spelling-race/retryVoicePrompt', () => ({
  createBrowserRetryPromptPort: () => ({
    play: (word: string, onDone: () => void) => {
      harness.promptWord = word
      harness.promptDone = onDone
    },
    cancel: () => {
      harness.promptCancelCount += 1
      harness.promptDone = null
    },
  }),
}))

const route: RouteCard = {
  id: 'fixture-harbour',
  label: 'Fixture harbour',
  shipping: true,
  circuit: { points: [], tension: 0.5, halfWidth: 8 },
  district: 'fixture',
  requiredAssets: [],
  optionalAssets: [],
  landmarks: [],
}

const assets: LoadedWorldAssets = {
  routeId: 'fixture-harbour',
  models: new Map(),
  textures: new Map(),
  missingOptional: [],
}

let container: HTMLDivElement
let root: Root
let mounted: boolean
let onExit: () => void

beforeEach(async () => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  harness.sessions.length = 0
  harness.promptDone = null
  harness.promptWord = null
  harness.promptCancelCount = 0
  window.__tinyGrandPrixTest = { seed: 1, timeScale: 1, countdownMs: 1 }
  window.__spellingRaceVoice = {
    start: (onResult, onError, onEnd) => {
      harness.sessions.push({ result: onResult, error: onError, end: onEnd })
    },
    stop: () => harness.sessions.at(-1)?.end(),
    abort: () => undefined,
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mounted = true
  onExit = vi.fn()
  await act(async () => {
    root.render(
      <RaceScreen
        difficulty="rookie"
        kartColour="red"
        steeringMode="touch"
        route={route}
        assets={assets}
        onFinished={() => undefined}
        onExit={onExit}
      />,
    )
  })
})

afterEach(async () => {
  if (mounted) await act(async () => root.unmount())
  delete window.__spellingRaceVoice
  delete window.__tinyGrandPrixTest
  document.body.replaceChildren()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  vi.useRealTimers()
})

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
    await Promise.resolve()
  })
}

async function beginWord(): Promise<string> {
  await act(async () => button('Start race').click())
  await advance(5)
  await advance(100)
  const word = container.querySelector('[data-testid="active-word"]')?.textContent ?? ''
  expect(word).not.toBe('')
  await act(async () => button('Tap mic, then say it').click())
  expect(harness.sessions).toHaveLength(1)
  return word
}

function button(text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')]
    .find((element) => element.textContent?.includes(text))
  if (!match) throw new Error(`button not found: ${text}`)
  return match as HTMLButtonElement
}

function labelledButton(label: string): HTMLButtonElement {
  const match = container.querySelector(`button[aria-label="${label}"]`)
  if (!match) throw new Error(`button not found with label: ${label}`)
  return match as HTMLButtonElement
}

async function beginPendingPrompt(): Promise<() => void> {
  await beginWord()
  await act(async () => {
    harness.sessions[0].result('something else')
    harness.sessions[0].end()
  })
  expect(harness.promptDone).not.toBeNull()
  return harness.promptDone!
}

describe('RaceScreen voice resilience', () => {
  it('prompts once, then defers an unresolved word without blocking the race', async () => {
    const firstWord = await beginWord()

    await act(async () => harness.sessions[0].result('bat'))
    expect(harness.promptWord).toBeNull()
    await act(async () => harness.sessions[0].end())
    expect(container.textContent).toContain('That was hard to hear. Listen, then try once more.')
    expect(container.textContent).toContain(`I can read ${firstWord}.`)
    expect(harness.promptWord).toBe(firstWord)
    await advance(6_000)
    expect(container.querySelector('[data-testid="active-word"]')?.textContent).toBe(firstWord)

    await act(async () => harness.promptDone?.())
    await advance(20)
    expect(harness.sessions).toHaveLength(2)

    await act(async () => {
      harness.sessions[1].result('I can read bat')
      harness.sessions[1].end()
    })
    expect(container.textContent).toContain("Let's bring that word back later. Keep racing!")
    expect(container.textContent).not.toContain('Voice took a pit stop')

    await advance(100)
    expect(container.querySelector('[data-testid="active-word"]')?.textContent).not.toBe(firstWord)
  })

  it('accepts the expected word from the carrier retry', async () => {
    const word = await beginWord()
    await act(async () => {
      harness.sessions[0].result('something else')
      harness.sessions[0].end()
    })
    await act(async () => harness.promptDone?.())
    await advance(20)
    await act(async () => {
      harness.sessions[1].result(`I can read ${word}`)
      harness.sessions[1].end()
    })

    expect(container.textContent).toContain('Turbo!')
    expect(container.textContent).not.toContain("Let's bring that word back later")
  })

  for (const code of ['no-speech', 'network', 'aborted', 'start-failed']) {
    it(`keeps ${code} non-blocking across the bounded attempts`, async () => {
      await beginWord()
      await act(async () => {
        harness.sessions[0].error(code)
        harness.sessions[0].end()
      })
      expect(container.textContent).toContain('That was hard to hear')
      await act(async () => harness.promptDone?.())
      await advance(20)
      await act(async () => {
        harness.sessions[1].error(code)
        harness.sessions[1].end()
      })
      expect(container.textContent).toContain("Let's bring that word back later")
      expect(container.textContent).not.toContain('Voice took a pit stop')
    })
  }

  it('still blocks when microphone permission is denied', async () => {
    await beginWord()
    await act(async () => harness.sessions[0].error('not-allowed'))
    expect(container.textContent).toContain('Voice took a pit stop')
    expect(container.textContent).toContain('Microphone access is off')
  })

  it('ignores stale recognition callbacks after Skip advances the word', async () => {
    const firstWord = await beginWord()
    const staleSession = harness.sessions[0]
    await act(async () => button('Skip').click())
    await advance(100)
    expect(container.querySelector('[data-testid="active-word"]')?.textContent).not.toBe(firstWord)

    await act(async () => staleSession.result(firstWord))
    expect(container.textContent).not.toContain('Turbo!')
  })

  it('cancels a pending prompt and ignores its stale completion after Skip', async () => {
    await beginWord()
    await act(async () => {
      harness.sessions[0].result('bat')
      harness.sessions[0].end()
    })
    const stalePromptDone = harness.promptDone
    const cancelCount = harness.promptCancelCount
    await act(async () => button('Skip').click())
    expect(harness.promptCancelCount).toBeGreaterThan(cancelCount)

    await act(async () => stalePromptDone?.())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })

  it('cancels a pending prompt while the race is paused', async () => {
    const stalePromptDone = await beginPendingPrompt()
    const cancelCount = harness.promptCancelCount
    await act(async () => labelledButton('Pause').click())
    await advance(0)
    expect(harness.promptCancelCount).toBeGreaterThan(cancelCount)

    await act(async () => stalePromptDone())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })

  it('cancels a pending prompt when the parent exits', async () => {
    const stalePromptDone = await beginPendingPrompt()
    const cancelCount = harness.promptCancelCount
    await act(async () => button('Parent exit').click())
    expect(onExit).toHaveBeenCalledOnce()
    expect(harness.promptCancelCount).toBeGreaterThan(cancelCount)

    await act(async () => stalePromptDone())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })

  it('cancels a pending prompt when the page becomes hidden', async () => {
    const stalePromptDone = await beginPendingPrompt()
    const cancelCount = harness.promptCancelCount
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    await advance(0)
    expect(harness.promptCancelCount).toBeGreaterThan(cancelCount)

    await act(async () => stalePromptDone())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })

  it('cancels a pending prompt on unmount', async () => {
    const stalePromptDone = await beginPendingPrompt()
    const cancelCount = harness.promptCancelCount
    await act(async () => root.unmount())
    mounted = false
    expect(harness.promptCancelCount).toBeGreaterThan(cancelCount)

    await act(async () => stalePromptDone())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })
})
