import { describe, expect, it } from 'vitest'
import { STARTER_LIST } from './starterPack'
import {
  loadWordList,
  resetToStarterList,
  saveWordList,
  validateWordList,
  WORD_LIST_STORAGE_KEY,
} from './wordList'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    keys: () => [...values.keys()],
  }
}

describe('validateWordList', () => {
  it('accepts three trimmed unique English words', () => {
    expect(validateWordList([' Cat ', 'dog', 'bright'])).toEqual({ valid: true, errors: [] })
  })

  it('reports duplicate and invalid words without changing the entries', () => {
    const words = ['cat', 'CAT', 'two words', '123']

    expect(validateWordList(words)).toEqual({
      valid: false,
      errors: [
        'Words must be unique.',
        '“two words” is not a single English word.',
        '“123” is not a single English word.',
      ],
    })
    expect(words).toEqual(['cat', 'CAT', 'two words', '123'])
  })

  it('rejects lists outside the three-to-twenty word range', () => {
    expect(validateWordList(['cat', 'dog'])).toEqual({
      valid: false,
      errors: ['Add at least 3 words.'],
    })
    expect(validateWordList(Array.from({ length: 21 }, () => 'word'))).toEqual({
      valid: false,
      errors: ['Use no more than 20 words.', 'Words must be unique.'],
    })
  })
})

describe('local word-list repository', () => {
  it('persists only the list under the fixed key and restores it', () => {
    const local = storage()

    saveWordList(local, STARTER_LIST)

    expect(local.keys()).toEqual([WORD_LIST_STORAGE_KEY])
    expect(loadWordList(local)).toEqual(STARTER_LIST)
  })

  it('resets to the approved starter list', () => {
    const local = storage()

    expect(resetToStarterList(local)).toEqual(STARTER_LIST)
    expect(loadWordList(local)).toEqual(STARTER_LIST)
  })

  it('returns null for invalid stored JSON', () => {
    const local = storage()
    local.setItem(WORD_LIST_STORAGE_KEY, '{')

    expect(loadWordList(local)).toBeNull()
  })
})
