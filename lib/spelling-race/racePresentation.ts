import type { RaceCard } from './types'

export function clueForCard(card: RaceCard): string {
  if (card.clueLevel >= 2) return `The word is ${card.expectedWord}. Say it when you are ready.`
  if (card.kind === 'missing-letters') {
    return `The first missing letter is ${card.expectedLetters[0]?.toUpperCase()}.`
  }
  if (card.kind === 'use-in-sentence') {
    return `Use ${card.expectedWord} in a whole sentence.`
  }
  return `It starts with ${card.expectedWord[0]?.toUpperCase()}. Give it another go.`
}
