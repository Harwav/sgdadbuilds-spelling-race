import type { SightWordResult } from './types'

export const WORD_WINDOW_MS = 5_000

export type Shuffle = (words: readonly string[]) => readonly string[]

type RetryWord = {
  word: string
  availableAfterResolved: number
}

export type WordDirectorState = {
  bankWords: readonly string[]
  shuffle: Shuffle
  remainingWords: readonly string[]
  retryWords: readonly RetryWord[]
  activeWord: string | null
  activeSinceMs: number | null
  resolvedWordCount: number
  timeoutCounts: Readonly<Record<string, number>>
  lastResolvedWord: string | null
  helpAvailable: boolean
  results: readonly SightWordResult[]
}

export function createWordDirector(words: readonly string[], shuffle: Shuffle = (items) => items): WordDirectorState {
  const uniqueWords = words.filter((word, index) => words.indexOf(word) === index)
  const bankWords = [...shuffle(uniqueWords)]
  return {
    bankWords,
    shuffle,
    remainingWords: [...bankWords],
    retryWords: [],
    activeWord: null,
    activeSinceMs: null,
    resolvedWordCount: 0,
    timeoutCounts: {},
    lastResolvedWord: null,
    helpAvailable: false,
    results: [],
  }
}

export function showNextWord(state: WordDirectorState, nowMs: number): WordDirectorState {
  if (state.activeWord !== null) return state

  const retryIndex = state.retryWords.findIndex((retry) => retry.availableAfterResolved <= state.resolvedWordCount)
  if (retryIndex >= 0) {
    const retry = state.retryWords[retryIndex]
    return {
      ...state,
      retryWords: state.retryWords.filter((_, index) => index !== retryIndex),
      activeWord: retry.word,
      activeSinceMs: nowMs,
    }
  }

  let [nextWord, ...remainingWords] = state.remainingWords
  if (nextWord === undefined) {
    const retryingWords = new Set(state.retryWords.map((retry) => retry.word))
    const freshDeck = [...state.shuffle(state.bankWords.filter((word) => !retryingWords.has(word)))]
    if (freshDeck.length > 1 && freshDeck[0] === state.lastResolvedWord) freshDeck.push(freshDeck.shift()!)
    ;[nextWord, ...remainingWords] = freshDeck
  }
  if (nextWord === undefined) return state
  return { ...state, remainingWords, activeWord: nextWord, activeSinceMs: nowMs }
}

export function acceptActiveWord(
  state: WordDirectorState,
  nowMs: number,
): { state: WordDirectorState; boostRatio: number } {
  if (state.activeWord === null || state.activeSinceMs === null) return { state, boostRatio: 0 }

  const elapsedMs = Math.max(0, nowMs - state.activeSinceMs)
  return {
    state: resolveActiveWord(state, 'accepted', elapsedMs),
    boostRatio: clamp(1 - elapsedMs / WORD_WINDOW_MS, 0, 1),
  }
}

export function timeoutActiveWord(state: WordDirectorState, nowMs: number): WordDirectorState {
  if (state.activeWord === null || state.activeSinceMs === null || nowMs - state.activeSinceMs < WORD_WINDOW_MS) return state

  const word = state.activeWord
  const timeoutCount = (state.timeoutCounts[word] ?? 0) + 1
  const timeoutCounts = { ...state.timeoutCounts, [word]: timeoutCount }
  const timeoutResult: SightWordResult = { word, outcome: 'timeout', elapsedMs: WORD_WINDOW_MS }
  const resolvedWordCount = state.resolvedWordCount + 1
  const timedOut = {
    ...state,
    timeoutCounts,
    resolvedWordCount,
    results: [...state.results, timeoutResult],
  }

  if (timeoutCount >= 2) return { ...timedOut, helpAvailable: true }

  return {
    ...timedOut,
    retryWords: [
      ...timedOut.retryWords,
      { word, availableAfterResolved: resolvedWordCount + 2 },
    ],
    activeWord: null,
    activeSinceMs: null,
  }
}

export function assistActiveWord(state: WordDirectorState): WordDirectorState {
  if (state.activeWord === null || !state.helpAvailable) return state
  return resolveActiveWord(state, 'assisted', null)
}

function resolveActiveWord(
  state: WordDirectorState,
  outcome: 'accepted' | 'assisted',
  elapsedMs: number | null,
): WordDirectorState {
  if (state.activeWord === null) return state
  return {
    ...state,
    activeWord: null,
    activeSinceMs: null,
    resolvedWordCount: state.resolvedWordCount + 1,
    lastResolvedWord: state.activeWord,
    helpAvailable: false,
    results: [...state.results, { word: state.activeWord, outcome, elapsedMs }],
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
