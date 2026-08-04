import { expect, it } from 'vitest'
import { buildRaceQueue, completeCard, isRaceComplete, scheduleRetry } from './raceQueue'

const list = {
  version: 1,
  title: 'Test',
  words: [
    { id: 'cat', word: 'cat', sentence: 'The cat can run.' },
    { id: 'bright', word: 'bright', sentence: 'The sun is bright.' },
    { id: 'train', word: 'train', sentence: 'The train is fast.' },
  ],
} as const

it('creates three cards per word and does not blank the first letter', () => {
  const queue = buildRaceQueue(list)

  expect(queue.pending).toHaveLength(9)
  const brightCard = queue.pending.find((card) => card.wordId === 'bright' && card.kind === 'missing-letters')
  expect(brightCard?.expectedLetters).toEqual(['r', 'g'])
  expect(brightCard?.prompt).toContain('B _ I _ H T')

  const sentenceCard = queue.pending.find((card) => card.wordId === 'bright' && card.kind === 'use-in-sentence')
  expect(sentenceCard?.prompt).toBe('Finish the sentence: The sun is ____.')
})

it('returns a retry after two other cards where possible', () => {
  const queue = buildRaceQueue(list)
  const retried = scheduleRetry(queue, queue.pending[0])

  expect(retried.pending.slice(0, 2).map((card) => card.id)).not.toContain(queue.pending[0].id)
  expect(retried.pending[2]).toMatchObject({ id: queue.pending[0].id, attempts: 1, clueLevel: 1 })
})

it('has a finite completion path', () => {
  let queue = buildRaceQueue(list)

  for (const card of [...queue.pending]) queue = completeCard(queue, card.id)

  expect(isRaceComplete(queue)).toBe(true)
})
