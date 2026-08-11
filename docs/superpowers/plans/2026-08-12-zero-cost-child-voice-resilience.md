# Zero-cost Child Voice Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce false rejection of children's accented sight-word pronunciation while ensuring uncertain speech never earns a false success or blocks the race.

**Architecture:** Keep Safari Web Speech as the recognition boundary, but separate transcript evidence from the two-attempt race policy. Pure matcher and policy modules decide whether evidence is strong, a cancellable browser prompt scaffolds one retry, and the word director defers unresolved words without inventing acceptance or timeout results.

**Tech Stack:** Next.js 16.3 App Router, React 19 Client Components, TypeScript 5, Vitest 4 with jsdom, native Web Speech and Speech Synthesis APIs.

## Global Constraints

- Add no paid service, cloud API, audio recording, transcript persistence, Whisper, Vosk, or new runtime dependency.
- Keep `en-SG`, interim results, five recognition alternatives, and exact-match priority.
- Never accept a short word through generic edit distance or generic phonetic similarity.
- A word gets at most two completed attempts: isolated word, then the carrier phrase `I can read <word>`.
- Only strong evidence awards turbo; a second unresolved attempt is deferred with zero boost and returns after two other resolved words.
- Permission/capability failures may block; `no-speech`, `aborted`, `network`, and `start-failed` must not freeze the race.
- Recognition and synthesis must never overlap, and all stale callbacks must remain token-guarded.
- Keep audio and transcripts unpersisted; transcripts may appear only in the opt-in in-memory `voice-debug` view and never in analytics.
- Preserve unrelated dirty-worktree changes. Execute this plan in an isolated worktree created with `superpowers:using-git-worktrees`.
- Follow the installed Next.js 16.3 guidance in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, and `node_modules/next/dist/docs/03-architecture/supported-browsers.md`.

---

## File structure

- Modify `lib/spelling-race/transcriptMatcher.ts`: carrier-phrase evidence extraction while preserving conservative short-word matching.
- Modify `lib/spelling-race/transcriptMatcher.test.ts`: isolated and carrier evidence tests.
- Modify `lib/spelling-race/types.ts`: add the explicit `deferred` sight-word outcome.
- Modify `lib/spelling-race/wordDirector.ts`: schedule unresolved words without recording a timeout.
- Modify `lib/spelling-race/wordDirector.test.ts`: deferred scheduling and result coverage.
- Create `lib/spelling-race/voiceTurnPolicy.ts`: pure mapping from attempt/evidence/error to accept, prompt, defer, or block.
- Create `lib/spelling-race/voiceTurnPolicy.test.ts`: exhaustive policy tests.
- Create `lib/spelling-race/retryVoicePrompt.ts`: cancellable Speech Synthesis adapter with a bounded fallback.
- Create `lib/spelling-race/retryVoicePrompt.test.ts`: completion, fallback, timeout, and cancellation tests.
- Modify `components/spelling-race/RaceScreen.tsx`: wire the policy, prompt, deferred results, non-blocking errors, and neutral feedback into the existing recognition lifecycle.
- Create `lib/spelling-race/raceVoiceResilience.test.tsx`: RaceScreen regression coverage using injected voice and synthesis fakes.

### Task 1: Add carrier-phrase evidence without weakening short words

**Files:**

- Modify: `lib/spelling-race/transcriptMatcher.ts`
- Modify: `lib/spelling-race/transcriptMatcher.test.ts`

**Interfaces:**

- Produces: `SightWordAttemptMode = 'isolated' | 'carrier'`.
- Produces: `evaluateSightWordAnswer(target, candidates, isFinal?, attemptMode?)` with `attemptMode` defaulting to `'isolated'` for existing callers.
- Preserves: `SightWordMatch` and all existing exact/phonetic/retry result shapes.

- [ ] **Step 1: Write failing carrier-mode tests**

Add these cases inside `describe('evaluateSightWordAnswer')`:

```ts
it('extracts the expected word from the fixed retry carrier phrase', () => {
  expect(evaluateSightWordAnswer('bright', ['I can read bright'], true, 'carrier')).toEqual({
    outcome: 'accepted', match: 'exact', detected: 'bright',
  })
  expect(evaluateSightWordAnswer('bright', ['I can read brite'], true, 'carrier')).toEqual({
    outcome: 'accepted', match: 'phonetic', detected: 'brite',
  })
})

it('does not let carrier words count as the expected word', () => {
  expect(evaluateSightWordAnswer('read', ['I can read cat'], true, 'carrier')).toEqual({
    outcome: 'retry', reason: 'different-word', detected: 'cat',
  })
})

it('keeps unrelated short words strict in carrier mode', () => {
  expect(evaluateSightWordAnswer('cat', ['I can read bat'], true, 'carrier')).toEqual({
    outcome: 'retry', reason: 'different-word', detected: 'bat',
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the new calls fail**

Run: `npm test -- lib/spelling-race/transcriptMatcher.test.ts`

Expected: FAIL because `evaluateSightWordAnswer` does not accept a fourth argument and treats the full carrier phrase as one candidate.

- [ ] **Step 3: Implement attempt-mode extraction**

Add the exported mode and a focused extractor:

```ts
export type SightWordAttemptMode = 'isolated' | 'carrier'

function evidenceCandidates(values: readonly string[], mode: SightWordAttemptMode): string[] {
  const normalised = values.map(normaliseTranscript).filter(Boolean)
  if (mode === 'isolated') return normalised
  return normalised
    .map((candidate) => candidate.split(' ').at(-1) ?? '')
    .filter(Boolean)
}
```

Change the function signature and use the extractor:

```ts
export function evaluateSightWordAnswer(
  target: string,
  candidates: readonly string[],
  isFinal = true,
  attemptMode: SightWordAttemptMode = 'isolated',
): SightWordMatch | null {
  const expected = normaliseTranscript(target)
  const normalisedCandidates = evidenceCandidates(candidates, attemptMode)
```

Do not change `SHORT_WORD_CONFUSIONS`, `isStrongPhoneticVariant`, or their safety ordering in this task.

- [ ] **Step 4: Run matcher tests**

Run: `npm test -- lib/spelling-race/transcriptMatcher.test.ts lib/spelling-race/voiceCapability.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the matcher change**

```bash
git add lib/spelling-race/transcriptMatcher.ts lib/spelling-race/transcriptMatcher.test.ts
git commit -m "feat: evaluate scaffolded voice retries"
```

### Task 2: Model deferred words explicitly

**Files:**

- Modify: `lib/spelling-race/types.ts`
- Modify: `lib/spelling-race/wordDirector.ts`
- Modify: `lib/spelling-race/wordDirector.test.ts`

**Interfaces:**

- Produces: `SightWordResult['outcome']` including `'deferred'`.
- Produces: `deferActiveWord(state: WordDirectorState): WordDirectorState`.
- Preserves: retry scheduling after two other resolved words.

- [ ] **Step 1: Write a failing deferred-word test**

Import `deferActiveWord`, then add:

```ts
it('defers an unresolved word until two other words resolve', () => {
  let state = showNextWord(createWordDirector(['cat', 'dog', 'sun']), 0)
  state = deferActiveWord(state)

  expect(state.results.at(-1)).toEqual({ word: 'cat', outcome: 'deferred', elapsedMs: null })
  expect(state.timeoutCounts).toEqual({})

  state = showNextWord(state, 1)
  expect(state.activeWord).toBe('dog')
  state = acceptActiveWord(state, 1).state
  state = showNextWord(state, 2)
  expect(state.activeWord).toBe('sun')
  state = acceptActiveWord(state, 2).state
  state = showNextWord(state, 3)
  expect(state.activeWord).toBe('cat')
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- lib/spelling-race/wordDirector.test.ts`

Expected: FAIL because `deferActiveWord` and the `deferred` result outcome do not exist.

- [ ] **Step 3: Add the deferred outcome and scheduler**

Extend `SightWordResult`:

```ts
export type SightWordResult = {
  word: string
  outcome: 'accepted' | 'timeout' | 'assisted' | 'skipped' | 'deferred'
  elapsedMs: number | null
}
```

Add this function next to `skipActiveWord`:

```ts
export function deferActiveWord(state: WordDirectorState): WordDirectorState {
  if (state.activeWord === null) return state

  const word = state.activeWord
  const resolvedWordCount = state.resolvedWordCount + 1
  return {
    ...state,
    activeWord: null,
    activeSinceMs: null,
    resolvedWordCount,
    lastResolvedWord: word,
    helpAvailable: false,
    retryWords: [
      ...state.retryWords.filter((retry) => retry.word !== word),
      { word, availableAfterResolved: resolvedWordCount + 2 },
    ],
    results: [...state.results, { word, outcome: 'deferred', elapsedMs: null }],
  }
}
```

- [ ] **Step 4: Run word-director and recap-adjacent tests**

Run: `npm test -- lib/spelling-race/wordDirector.test.ts lib/spelling-race/raceQueue.test.ts lib/spelling-race/progression.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain change**

```bash
git add lib/spelling-race/types.ts lib/spelling-race/wordDirector.ts lib/spelling-race/wordDirector.test.ts
git commit -m "feat: defer unresolved sight words"
```

### Task 3: Isolate the two-attempt voice policy

**Files:**

- Create: `lib/spelling-race/voiceTurnPolicy.ts`
- Create: `lib/spelling-race/voiceTurnPolicy.test.ts`

**Interfaces:**

- Consumes: `SightWordAttemptMode` from `transcriptMatcher.ts`.
- Produces: `VoiceEvidence = 'accepted' | 'unresolved'`.
- Produces: `VoiceTurnDecision = { kind: 'accept' } | { kind: 'prompt-retry' } | { kind: 'defer' } | { kind: 'block'; code: string }`.
- Produces: `decideVoiceEvidence(mode, evidence)` and `decideVoiceError(mode, code)`.

- [ ] **Step 1: Create exhaustive failing policy tests**

Create `voiceTurnPolicy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decideVoiceError, decideVoiceEvidence } from './voiceTurnPolicy'

describe('voice turn policy', () => {
  it('accepts strong evidence on either attempt', () => {
    expect(decideVoiceEvidence('isolated', 'accepted')).toEqual({ kind: 'accept' })
    expect(decideVoiceEvidence('carrier', 'accepted')).toEqual({ kind: 'accept' })
  })

  it('prompts once, then defers unresolved evidence', () => {
    expect(decideVoiceEvidence('isolated', 'unresolved')).toEqual({ kind: 'prompt-retry' })
    expect(decideVoiceEvidence('carrier', 'unresolved')).toEqual({ kind: 'defer' })
  })

  it('blocks only permission failures', () => {
    for (const code of ['not-allowed', 'service-not-allowed']) {
      expect(decideVoiceError('isolated', code)).toEqual({ kind: 'block', code })
    }
  })

  it('treats recognition failures as bounded unresolved attempts', () => {
    for (const code of ['no-speech', 'aborted', 'network', 'start-failed']) {
      expect(decideVoiceError('isolated', code)).toEqual({ kind: 'prompt-retry' })
      expect(decideVoiceError('carrier', code)).toEqual({ kind: 'defer' })
    }
  })
})
```

- [ ] **Step 2: Run the new test and confirm the missing module failure**

Run: `npm test -- lib/spelling-race/voiceTurnPolicy.test.ts`

Expected: FAIL because `voiceTurnPolicy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy**

Create `voiceTurnPolicy.ts`:

```ts
import type { SightWordAttemptMode } from './transcriptMatcher'

export type VoiceEvidence = 'accepted' | 'unresolved'

export type VoiceTurnDecision =
  | { kind: 'accept' }
  | { kind: 'prompt-retry' }
  | { kind: 'defer' }
  | { kind: 'block'; code: string }

export function decideVoiceEvidence(
  mode: SightWordAttemptMode,
  evidence: VoiceEvidence,
): VoiceTurnDecision {
  if (evidence === 'accepted') return { kind: 'accept' }
  return mode === 'isolated' ? { kind: 'prompt-retry' } : { kind: 'defer' }
}

export function decideVoiceError(mode: SightWordAttemptMode, code: string): VoiceTurnDecision {
  if (code === 'not-allowed' || code === 'service-not-allowed') return { kind: 'block', code }
  return mode === 'isolated' ? { kind: 'prompt-retry' } : { kind: 'defer' }
}
```

- [ ] **Step 4: Run the policy tests**

Run: `npm test -- lib/spelling-race/voiceTurnPolicy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the policy module**

```bash
git add lib/spelling-race/voiceTurnPolicy.ts lib/spelling-race/voiceTurnPolicy.test.ts
git commit -m "feat: define bounded voice attempt policy"
```

### Task 4: Add a cancellable retry prompt

**Files:**

- Create: `lib/spelling-race/retryVoicePrompt.ts`
- Create: `lib/spelling-race/retryVoicePrompt.test.ts`

**Interfaces:**

- Produces: `RetryPromptPort = { play(word, onDone): void; cancel(): void }`.
- Produces: `createRetryPromptPort(adapter, timeoutMs?)` for unit tests.
- Produces: `createBrowserRetryPromptPort()` for `RaceScreen`.
- Guarantees: `onDone` runs at most once; cancellation never completes a prompt; missing synthesis falls back immediately; timeout defaults to `3_000` ms.

- [ ] **Step 1: Write failing prompt-port tests**

Create tests with fake timers and a captured utterance:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryPromptPort, type RetryPromptUtterance } from './retryVoicePrompt'

afterEach(() => vi.useRealTimers())

describe('retry voice prompt', () => {
  it('speaks the word and carrier phrase, then completes once', () => {
    const done = vi.fn()
    let utterance: RetryPromptUtterance | null = null
    const port = createRetryPromptPort({
      makeUtterance: (text) => ({ text, lang: '', rate: 1, onend: null, onerror: null }),
      speak: (value) => { utterance = value },
      cancel: vi.fn(),
    })

    port.play('bright', done)
    expect(utterance?.text).toBe('bright. I can read bright.')
    expect(utterance?.lang).toBe('en-SG')
    utterance?.onend?.()
    utterance?.onerror?.()
    expect(done).toHaveBeenCalledOnce()
  })

  it('falls back when synthesis is unavailable', () => {
    const done = vi.fn()
    createRetryPromptPort(null).play('cat', done)
    expect(done).toHaveBeenCalledOnce()
  })

  it('times out a stuck prompt and suppresses completion after cancel', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const cancel = vi.fn()
    const port = createRetryPromptPort({
      makeUtterance: (text) => ({ text, lang: '', rate: 1, onend: null, onerror: null }),
      speak: () => undefined,
      cancel,
    })

    port.play('cat', done)
    vi.advanceTimersByTime(3_000)
    expect(done).toHaveBeenCalledOnce()

    port.play('dog', done)
    port.cancel()
    vi.advanceTimersByTime(3_000)
    expect(cancel).toHaveBeenCalled()
    expect(done).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the new test and confirm the missing module failure**

Run: `npm test -- lib/spelling-race/retryVoicePrompt.test.ts`

Expected: FAIL because `retryVoicePrompt.ts` does not exist.

- [ ] **Step 3: Implement the prompt port and browser adapter**

Create a small adapter-based module:

```ts
import { SPEECH_LANGUAGE } from './voiceCapability'

export type RetryPromptUtterance = {
  text: string
  lang: string
  rate: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

type RetryPromptAdapter = {
  makeUtterance(text: string): RetryPromptUtterance
  speak(utterance: RetryPromptUtterance): void
  cancel(): void
}

export type RetryPromptPort = {
  play(word: string, onDone: () => void): void
  cancel(): void
}

export function createRetryPromptPort(
  adapter: RetryPromptAdapter | null,
  timeoutMs = 3_000,
): RetryPromptPort {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const clear = () => {
    if (timeout !== null) clearTimeout(timeout)
    timeout = null
  }

  return {
    play(word, onDone) {
      generation += 1
      const current = generation
      clear()
      if (!adapter) {
        onDone()
        return
      }
      let completed = false
      const finish = () => {
        if (completed || current !== generation) return
        completed = true
        clear()
        onDone()
      }
      const utterance = adapter.makeUtterance(`${word}. I can read ${word}.`)
      utterance.lang = SPEECH_LANGUAGE
      utterance.rate = 0.85
      utterance.onend = finish
      utterance.onerror = finish
      timeout = setTimeout(finish, timeoutMs)
      adapter.speak(utterance)
    },
    cancel() {
      generation += 1
      clear()
      adapter?.cancel()
    },
  }
}

export function createBrowserRetryPromptPort(): RetryPromptPort {
  if (
    typeof window === 'undefined'
    || typeof window.speechSynthesis === 'undefined'
    || typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return createRetryPromptPort(null)
  }
  return createRetryPromptPort({
    makeUtterance: (text) => new SpeechSynthesisUtterance(text),
    speak: (utterance) => window.speechSynthesis.speak(utterance as SpeechSynthesisUtterance),
    cancel: () => window.speechSynthesis.cancel(),
  })
}
```

- [ ] **Step 4: Run prompt tests**

Run: `npm test -- lib/spelling-race/retryVoicePrompt.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the prompt module**

```bash
git add lib/spelling-race/retryVoicePrompt.ts lib/spelling-race/retryVoicePrompt.test.ts
git commit -m "feat: add scaffolded retry voice prompt"
```

### Task 5: Wire resilient attempts into the race

**Files:**

- Modify: `components/spelling-race/RaceScreen.tsx`
- Create: `lib/spelling-race/raceVoiceResilience.test.tsx`

**Interfaces:**

- Consumes: `deferActiveWord`, `SightWordAttemptMode`, `decideVoiceEvidence`, `decideVoiceError`, and `createBrowserRetryPromptPort`.
- Produces: child-facing two-attempt flow with no transcript claims, zero-boost deferral, and non-blocking transient errors.
- Preserves: recognition token guards, hands-free restart, timer semantics, manual Skip, pause/exit/visibility cleanup, and analytics without transcripts.

- [ ] **Step 1: Write failing RaceScreen flow tests**

Create `raceVoiceResilience.test.tsx` with the complete harness below. It replaces the 3D scene and audio engine, captures injected recognition callbacks, and captures prompt completion without relying on jsdom speech synthesis:

```tsx
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

beforeEach(async () => {
  vi.useFakeTimers()
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
  await act(async () => {
    root.render(
      <RaceScreen
        difficulty="rookie"
        kartColour="red"
        steeringMode="touch"
        route={route}
        assets={assets}
        onFinished={() => undefined}
        onExit={() => undefined}
      />,
    )
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  delete window.__spellingRaceVoice
  delete window.__tinyGrandPrixTest
  document.body.replaceChildren()
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

describe('RaceScreen voice resilience', () => {
  it('prompts once, then defers an unresolved word without blocking the race', async () => {
    const firstWord = await beginWord()

    await act(async () => harness.sessions[0].result('bat'))
    expect(harness.promptWord).toBeNull()
    await act(async () => harness.sessions[0].end())
    expect(container.textContent).toContain('That was hard to hear. Listen, then try once more.')
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
    await act(async () => button('Skip').click())
    expect(harness.promptCancelCount).toBeGreaterThan(0)

    await act(async () => stalePromptDone?.())
    await advance(20)
    expect(harness.sessions).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the new component test and confirm it fails**

Run: `npm test -- lib/spelling-race/raceVoiceResilience.test.tsx`

Expected: FAIL because RaceScreen still resolves every final mismatch as a normal retry, has no prompt port, and blocks on transient errors.

- [ ] **Step 3: Add attempt and prompt lifecycle refs**

In `RaceScreen`, import the new modules and `deferActiveWord`. Add:

```ts
const voiceAttemptModeRef = useRef<SightWordAttemptMode>('isolated')
const retryPromptRef = useRef(createBrowserRetryPromptPort())
const afterRecognitionEndRef = useRef<null | { kind: 'prompt-retry' | 'defer'; word: string }>(null)
```

Reset `voiceAttemptModeRef.current = 'isolated'` whenever a new active word is shown. Clear the tracked attempt word on accept, defer, Skip, timeout, and assistance so the same word starts fresh when it returns later. Cancel `retryPromptRef.current` from component cleanup, `stopRecognition`, pause/freeze handling, Skip, exit, and successful word resolution.

- [ ] **Step 4: Make candidate handling return evidence**

Call the matcher with the current mode:

```ts
const result = evaluateSightWordAnswer(
  current.activeWord,
  candidates,
  isFinal,
  voiceAttemptModeRef.current,
)
```

Keep the existing accepted-word boost path. For a final retry result, return `'unresolved'` without asserting `I heard ...` in ordinary feedback. Record candidate transcripts only through `recordVoiceTrace` when `voiceDebug` is enabled; continue sending only boolean/action/lifecycle metadata through `voiceDiagnostics`.

- [ ] **Step 5: Apply policy decisions after recognition closes**

For accepted or unresolved matcher evidence, call `decideVoiceEvidence`. For `onError`, call `decideVoiceError`.

- `{ kind: 'accept' }`: keep the accepted path and close the turn.
- `{ kind: 'block' }`: retain `interruptSpeech(code)` and the parent overlay.
- `{ kind: 'prompt-retry' }`: set neutral feedback, clear hands-free auto-restart for this close, set `afterRecognitionEndRef` to the current word, and close recognition.
- `{ kind: 'defer' }`: set `afterRecognitionEndRef` to defer the current word and close recognition.

In `onEnd`, after clearing `recognitionOpenRef`, consume `afterRecognitionEndRef` before the ordinary hands-free restart:

```ts
if (afterEnd?.kind === 'prompt-retry') {
  setFeedback('That was hard to hear. Listen, then try once more.')
  retryPromptRef.current.play(afterEnd.word, () => {
    if (directorRef.current.activeWord !== afterEnd.word || frozenRef.current) return
    voiceAttemptModeRef.current = 'carrier'
    setListenAttempt((value) => value + 1)
  })
  return
}

if (afterEnd?.kind === 'defer') {
  const deferred = deferActiveWord(directorRef.current)
  publishDirector(deferred)
  setFeedback("Let's bring that word back later. Keep racing!")
  setListenAttempt((value) => value + 1)
  return
}
```

The existing effect will restart recognition when the prompt increments `listenAttempt` and hands-free listening remains enabled. Ensure `wordArmedRef` is false during prompt playback so the word clock is paused.

- [ ] **Step 6: Include deferred words in practice results and neutralize transcript copy**

Update the race-finish practice filter:

```ts
.filter((result) => (
  result.outcome === 'timeout'
  || result.outcome === 'assisted'
  || result.outcome === 'skipped'
  || result.outcome === 'deferred'
))
```

Replace ordinary retry receipts that name the detected transcript with the neutral first-retry and deferred messages from the spec. Keep exact candidate text only in the in-memory debug trace.

- [ ] **Step 7: Run focused voice-flow tests**

Run:

```bash
npm test -- \
  lib/spelling-race/raceVoiceResilience.test.tsx \
  lib/spelling-race/transcriptMatcher.test.ts \
  lib/spelling-race/voiceTurnPolicy.test.ts \
  lib/spelling-race/retryVoicePrompt.test.ts \
  lib/spelling-race/wordDirector.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit RaceScreen integration without staging unrelated user changes**

In the isolated worktree, verify `git diff -- components/spelling-race/RaceScreen.tsx` contains only this feature, then run:

```bash
git add components/spelling-race/RaceScreen.tsx lib/spelling-race/raceVoiceResilience.test.tsx
git diff --cached --check
git commit -m "feat: keep races moving through voice uncertainty"
```

### Task 6: Verify the complete feature

**Files:**

- Verify all files changed in Tasks 1–5.
- Do not modify unrelated dirty-worktree files.

**Interfaces:**

- Verifies: matcher safety, bounded attempts, lifecycle cleanup, type compatibility, lint, production build, and commit scope.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0 with no warnings.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js 16.3 production build exits 0.

- [ ] **Step 4: Inspect the complete feature diff**

Run:

```bash
git status --short
git log --oneline --decorate -6
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: only the planned voice-resilience implementation files appear after the plan commit that forms the feature branch base.

- [ ] **Step 5: Perform target-device verification**

On current Safari for iPad, run at least 30 utterances across short words, long words, common homophones, and known accented trouble words. Manually record only these aggregate counts outside the app: correct accepted, correct deferred, incorrect rejected, incorrect accepted, and median visible response time.

Acceptance gate: zero observed incorrect pronunciations are accepted. Correct deferrals are allowed but must not block the race; confirmed repeated mistranscriptions may be proposed later as target-specific confusion entries.

- [ ] **Step 6: Request code review before integration**

Invoke `superpowers:requesting-code-review` with the design spec, this plan, the feature-branch diff, and verification output. Address only technically validated findings, then rerun the affected tests plus the complete verification commands before claiming completion.
