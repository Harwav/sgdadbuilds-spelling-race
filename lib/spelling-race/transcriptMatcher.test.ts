import { describe, expect, it } from 'vitest'
import { evaluateRaceAnswer, evaluateSightWordAnswer, normaliseTranscript, spokenLetters } from './transcriptMatcher'

const bright = { id: 'bright', word: 'bright', sentence: 'The sun is bright.', aliases: ['brite'] }

describe('normaliseTranscript', () => {
  it('lowercases, trims, and removes punctuation', () => {
    expect(normaliseTranscript('  Bright!  ')).toBe('bright')
  })
})

describe('spokenLetters', () => {
  it('recognises common spoken letter names in order', () => {
    expect(spokenLetters('are gee')).toEqual(['r', 'g'])
  })
})

describe('evaluateRaceAnswer', () => {
  it('accepts exact words and a one-edit close transcript for five-plus-letter words', () => {
    expect(evaluateRaceAnswer({ kind: 'say-word', expectedWord: 'bright' }, 'Bright!', bright))
      .toEqual({ outcome: 'accepted', match: 'exact' })
    expect(evaluateRaceAnswer({ kind: 'say-word', expectedWord: 'bright' }, 'brite', bright))
      .toEqual({ outcome: 'accepted', match: 'close' })
  })

  it('does not close-match a short different word', () => {
    expect(evaluateRaceAnswer({ kind: 'say-word', expectedWord: 'cat' }, 'bat', { id: 'cat', word: 'cat' }))
      .toEqual({ outcome: 'retry', reason: 'different-word' })
  })

  it('requires ordered missing letters and a complete sentence containing the word', () => {
    expect(evaluateRaceAnswer({ kind: 'missing-letters', expectedLetters: ['r', 'g'] }, 'are gee', bright))
      .toEqual({ outcome: 'accepted', match: 'exact' })
    expect(evaluateRaceAnswer({ kind: 'missing-letters', expectedLetters: ['r', 'g'] }, 'gee are', bright))
      .toEqual({ outcome: 'retry', reason: 'letters-mismatch' })
    expect(evaluateRaceAnswer({ kind: 'use-in-sentence', expectedWord: 'bright' }, 'The sun is bright.', bright))
      .toEqual({ outcome: 'accepted', match: 'exact' })
    expect(evaluateRaceAnswer({ kind: 'use-in-sentence', expectedWord: 'bright' }, 'bright', bright))
      .toEqual({ outcome: 'retry', reason: 'sentence-missing-word' })
  })
})

describe('evaluateSightWordAnswer', () => {
  it('accepts an exact target from a later recognition alternative', () => {
    expect(evaluateSightWordAnswer('bright', ['brite', 'bright'])).toEqual({
      outcome: 'accepted', match: 'exact', detected: 'bright',
    })
  })

  it('accepts only an exact interim word and ignores an unfinished non-match', () => {
    expect(evaluateSightWordAnswer('bright', ['bright'], false)).toEqual({
      outcome: 'accepted', match: 'exact', detected: 'bright',
    })
    expect(evaluateSightWordAnswer('bright', ['bri'], false)).toBeNull()
  })

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

  it('accepts a strong phonetic variant for targets with five or more characters', () => {
    expect(evaluateSightWordAnswer('bright', ['brite'])).toEqual({
      outcome: 'accepted', match: 'phonetic', detected: 'brite',
    })
  })

  it('accepts generated homophones while preserving exact matches in candidate order', () => {
    expect(evaluateSightWordAnswer('see', ['sea'])).toEqual({
      outcome: 'accepted', match: 'phonetic', detected: 'sea',
    })
    expect(evaluateSightWordAnswer('see', ['sea', 'see'])).toEqual({
      outcome: 'accepted', match: 'exact', detected: 'see',
    })
    expect(evaluateSightWordAnswer('one', ['won'])).toEqual({
      outcome: 'accepted', match: 'phonetic', detected: 'won',
    })
  })

  it('accepts only configured short-word speech confusions', () => {
    expect(evaluateSightWordAnswer('an', ['and'])).toEqual({
      outcome: 'accepted', match: 'phonetic', detected: 'and',
    })
    expect(evaluateSightWordAnswer('am', ['and'])).toEqual({
      outcome: 'retry', reason: 'different-word', detected: 'and',
    })
    expect(evaluateSightWordAnswer('an', ['and', 'an'])).toEqual({
      outcome: 'accepted', match: 'exact', detected: 'an',
    })
  })

  it('rejects different words and never applies fallback to four-character targets', () => {
    expect(evaluateSightWordAnswer('tree', ['train'])).toEqual({
      outcome: 'retry', reason: 'different-word', detected: 'train',
    })
    expect(evaluateSightWordAnswer('cat', ['bat'])).toEqual({
      outcome: 'retry', reason: 'different-word', detected: 'bat',
    })
    expect(evaluateSightWordAnswer('tree', ['trea'])).toEqual({
      outcome: 'retry', reason: 'different-word', detected: 'trea',
    })
  })

  it('rejects built-in words that merely share a Double Metaphone code', () => {
    for (const [target, candidate] of [
      ['white', 'what'],
      ['white', 'it'],
      ['yellow', 'all'],
      ['could', 'cold'],
      ['every', 'over'],
    ]) {
      expect(evaluateSightWordAnswer(target, [candidate])).toEqual({
        outcome: 'retry', reason: 'different-word', detected: candidate,
      })
    }
  })
})
