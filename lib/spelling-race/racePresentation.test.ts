import { expect, it } from 'vitest'
import { clueForCard } from './racePresentation'
import type { RaceCard } from './types'

const card = (patch: Partial<RaceCard>): RaceCard => ({
  id: 'bright:say-word',
  wordId: 'bright',
  kind: 'say-word',
  prompt: 'Say: bright',
  expectedWord: 'bright',
  expectedLetters: ['r', 'g'],
  sentence: 'The sun is bright.',
  attempts: 1,
  clueLevel: 1,
  ...patch,
})

it('gives a useful first clue without punishment language', () => {
  expect(clueForCard(card({}))).toBe('It starts with B. Give it another go.')
  expect(clueForCard(card({ kind: 'missing-letters' }))).toBe('The first missing letter is R.')
})

it('makes the second clue more explicit', () => {
  expect(clueForCard(card({ clueLevel: 2 }))).toBe('The word is bright. Say it when you are ready.')
})
