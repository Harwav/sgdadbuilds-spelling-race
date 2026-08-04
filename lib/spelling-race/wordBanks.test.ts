import { describe, expect, it } from 'vitest'
import { bankForDifficulty, validateWordBanks } from './wordBanks'

describe('Dolch sight-word banks', () => {
  it('provides only lowercase, unique words in every difficulty', () => {
    for (const difficulty of ['rookie', 'racer', 'champion'] as const) {
      const words = bankForDifficulty(difficulty)
      expect(words.every((word) => /^[a-z]+(?:'[a-z]+)?$/.test(word))).toBe(true)
      expect(new Set(words).size).toBe(words.length)
    }
    expect(validateWordBanks()).toEqual([])
  })

  it('groups the specified Dolch levels into the three race difficulties', () => {
    expect(bankForDifficulty('rookie')).toEqual(expect.arrayContaining(['a', 'the', 'away']))
    expect(bankForDifficulty('racer')).toEqual(expect.arrayContaining(['after', 'always', 'because']))
    expect(bankForDifficulty('champion')).toEqual(expect.arrayContaining(['about', 'better', 'together']))
  })
})
