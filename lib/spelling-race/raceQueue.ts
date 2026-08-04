import type { LocalWordList, RaceCard, RaceRoundKind, SpellingWord } from './types'

export type RaceQueue = {
  pending: RaceCard[]
  completedIds: string[]
}

type WordListInput = Pick<LocalWordList, 'version' | 'title'> & { words: readonly SpellingWord[] }

export function buildRaceQueue(list: WordListInput): RaceQueue {
  return {
    pending: list.words.flatMap((word) => roundKinds.map((kind) => cardFor(word, kind))),
    completedIds: [],
  }
}

export function scheduleRetry(queue: RaceQueue, card: RaceCard): RaceQueue {
  const pending = queue.pending.filter((pendingCard) => pendingCard.id !== card.id)
  const attempts = card.attempts + 1
  const retry = {
    ...card,
    attempts,
    clueLevel: attempts === 1 ? 1 : 2,
  } satisfies RaceCard

  const retryIndex = Math.min(2, pending.length)
  pending.splice(retryIndex, 0, retry)

  return { ...queue, pending }
}

export function completeCard(queue: RaceQueue, cardId: string): RaceQueue {
  return {
    pending: queue.pending.filter((card) => card.id !== cardId),
    completedIds: queue.completedIds.includes(cardId) ? queue.completedIds : [...queue.completedIds, cardId],
  }
}

export function isRaceComplete(queue: RaceQueue): boolean {
  return queue.pending.length === 0
}

const roundKinds: RaceRoundKind[] = ['say-word', 'missing-letters', 'use-in-sentence']

function cardFor(word: SpellingWord, kind: RaceRoundKind): RaceCard {
  const missingIndexes = missingLetterIndexes(word.word)
  const expectedLetters = missingIndexes.map((index) => word.word[index])
  const sentence = word.sentence ?? `I can say ${word.word}.`

  return {
    id: `${word.id}:${kind}`,
    wordId: word.id,
    kind,
    prompt: promptFor(kind, word.word, missingIndexes, sentence),
    expectedWord: word.word,
    expectedLetters,
    sentence,
    attempts: 0,
    clueLevel: 0,
  }
}

function missingLetterIndexes(word: string): number[] {
  if (word.length <= 4) return [1]
  return [1, 3]
}

function promptFor(kind: RaceRoundKind, word: string, missingIndexes: number[], sentence: string): string {
  if (kind === 'say-word') return `Say: ${word}`
  if (kind === 'missing-letters') {
    const masked = word
      .split('')
      .map((letter, index) => (missingIndexes.includes(index) ? '_' : letter.toUpperCase()))
      .join(' ')
    return `${masked} — say the missing letters.`
  }
  return `Finish the sentence: ${sentenceFrame(sentence, word)}`
}

function sentenceFrame(sentence: string, word: string): string {
  const target = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return target.test(sentence) ? sentence.replace(target, '____') : 'I can say ____.'
}
