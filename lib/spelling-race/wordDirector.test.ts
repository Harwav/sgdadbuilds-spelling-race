import { describe, expect, it } from 'vitest'
import {
  WORD_WINDOW_MS,
  acceptActiveWord,
  assistActiveWord,
  createWordDirector,
  deferActiveWord,
  showNextWord,
  skipActiveWord,
  timeoutActiveWord,
} from './wordDirector'

describe('word director', () => {
  it('permanently skips one active word without a boost', () => {
    const active = showNextWord(createWordDirector(['cat', 'dog']), 0)
    const skipped = skipActiveWord(active)

    expect(skipped.boostRatio).toBe(0)
    expect(skipped.state).toMatchObject({
      activeWord: null,
      activeSinceMs: null,
      helpAvailable: false,
      skippedWords: ['cat'],
    })
    expect(skipped.state.results.at(-1)).toEqual({ word: 'cat', outcome: 'skipped', elapsedMs: null })

    const next = showNextWord(skipped.state, 1)
    expect(next.activeWord).toBe('dog')
  })

  it('stops offering words after every bank word is skipped', () => {
    let state = showNextWord(createWordDirector(['cat', 'dog']), 0)
    state = skipActiveWord(state).state
    state = showNextWord(state, 1)
    state = skipActiveWord(state).state

    expect(showNextWord(state, 2).activeWord).toBeNull()
  })

  it('uses every deck word before continuing with a fresh deck', () => {
    const initial = createWordDirector(['cat', 'dog'])
    const first = showNextWord(initial, 0)
    const acceptedFirst = acceptActiveWord(first, 0).state
    const second = showNextWord(acceptedFirst, 1)
    const acceptedSecond = acceptActiveWord(second, 1).state
    const continued = showNextWord(acceptedSecond, 2)

    expect(initial.activeWord).toBeNull()
    expect([first.activeWord, second.activeWord]).toEqual(['cat', 'dog'])
    expect(continued.activeWord).toBe('cat')
  })

  it('retries a timed-out word only after two other resolved words', () => {
    let state = showNextWord(createWordDirector(['cat', 'dog', 'sun']), 0)
    state = timeoutActiveWord(state, WORD_WINDOW_MS)
    state = showNextWord(state, WORD_WINDOW_MS)
    expect(state.activeWord).toBe('dog')
    state = acceptActiveWord(state, WORD_WINDOW_MS).state
    state = showNextWord(state, WORD_WINDOW_MS + 1)
    expect(state.activeWord).toBe('sun')
    state = acceptActiveWord(state, WORD_WINDOW_MS + 1).state
    state = showNextWord(state, WORD_WINDOW_MS + 2)

    expect(state.activeWord).toBe('cat')
  })

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

  it('does not time out a word before its five-second window ends', () => {
    const active = showNextWord(createWordDirector(['cat']), 100)

    expect(timeoutActiveWord(active, 100 + WORD_WINDOW_MS - 1)).toEqual(active)
  })

  it('returns a continuous boost ratio for accepted words', () => {
    const active = showNextWord(createWordDirector(['cat']), 0)

    expect(acceptActiveWord(active, 0).boostRatio).toBe(1)
    expect(acceptActiveWord(active, 2_500).boostRatio).toBe(0.5)
  })

  it('offers assistance after a second timeout and records the assisted word', () => {
    let state = showNextWord(createWordDirector(['cat', 'dog', 'sun']), 0)
    state = timeoutActiveWord(state, WORD_WINDOW_MS)
    state = showNextWord(state, WORD_WINDOW_MS)
    state = acceptActiveWord(state, WORD_WINDOW_MS).state
    state = showNextWord(state, WORD_WINDOW_MS + 1)
    state = acceptActiveWord(state, WORD_WINDOW_MS + 1).state
    state = showNextWord(state, WORD_WINDOW_MS + 2)
    state = timeoutActiveWord(state, WORD_WINDOW_MS * 2 + 2)
    const assisted = assistActiveWord(state)

    expect(state).toMatchObject({ activeWord: 'cat', helpAvailable: true })
    expect(assisted).toMatchObject({ activeWord: null, helpAvailable: false })
    expect(assisted.results.at(-1)).toMatchObject({ word: 'cat', outcome: 'assisted', elapsedMs: null })
  })

  it('keeps streaming after every word in a small bank times out', () => {
    let state = createWordDirector(['cat', 'dog', 'sun'])
    for (let index = 0; index < 3; index += 1) {
      state = showNextWord(state, index * WORD_WINDOW_MS)
      state = timeoutActiveWord(state, (index + 1) * WORD_WINDOW_MS)
    }

    state = showNextWord(state, WORD_WINDOW_MS * 3)

    expect(state.activeWord).toBe('cat')
  })
})
