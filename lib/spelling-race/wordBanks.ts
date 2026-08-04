import type { Difficulty } from './types'

const ROOKIE_WORDS = [
  'a', 'and', 'away', 'big', 'blue', 'can', 'come', 'down', 'find', 'for', 'funny', 'go', 'help', 'here', 'i', 'in', 'is',
  'it', 'jump', 'little', 'look', 'make', 'me', 'my', 'not', 'one', 'play', 'red', 'run', 'said', 'see', 'the', 'three',
  'to', 'two', 'up', 'we', 'where', 'yellow', 'you', 'all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came',
  'did', 'do', 'eat', 'four', 'get', 'good', 'have', 'he', 'into', 'like', 'must', 'new', 'no', 'now', 'on', 'our', 'out',
  'please', 'pretty', 'ran', 'ride', 'saw', 'say', 'she', 'so', 'soon', 'that', 'there', 'they', 'this', 'too', 'under',
  'want', 'was', 'well', 'went', 'what', 'white', 'who', 'will', 'with', 'yes',
] as const

const RACER_WORDS = [
  'after', 'again', 'an', 'any', 'as', 'ask', 'by', 'could', 'every', 'fly', 'from', 'give', 'giving', 'had', 'has', 'her',
  'him', 'his', 'how', 'just', 'know', 'let', 'live', 'may', 'of', 'old', 'once', 'open', 'over', 'put', 'round', 'some',
  'stop', 'take', 'thank', 'them', 'then', 'think', 'walk', 'were', 'when', 'always', 'around', 'because', 'been', 'before',
  'best', 'both', 'buy', 'call', 'cold', 'does', "don't", 'fast', 'first', 'five', 'found', 'gave', 'goes', 'green', 'its',
  'made', 'many', 'off', 'or', 'pull', 'read', 'right', 'sing', 'sit', 'sleep', 'tell', 'their', 'these', 'those', 'upon',
  'us', 'use', 'very', 'wash', 'which', 'why', 'wish', 'work', 'would', 'write', 'your',
] as const

const CHAMPION_WORDS = [
  'about', 'better', 'bring', 'carry', 'clean', 'cut', 'done', 'draw', 'drink', 'eight', 'fall', 'far', 'full', 'got', 'grow',
  'hold', 'hot', 'hurt', 'if', 'keep', 'kind', 'laugh', 'light', 'long', 'much', 'myself', 'never', 'only', 'own', 'pick',
  'seven', 'shall', 'show', 'six', 'small', 'start', 'ten', 'today', 'together', 'try', 'warm',
] as const

const BANKS: Record<Difficulty, readonly string[]> = {
  rookie: ROOKIE_WORDS,
  racer: RACER_WORDS,
  champion: CHAMPION_WORDS,
}

export function bankForDifficulty(difficulty: Difficulty): readonly string[] {
  return BANKS[difficulty]
}

export function validateWordBanks(): string[] {
  const errors: string[] = []

  for (const [difficulty, words] of Object.entries(BANKS)) {
    if (new Set(words).size !== words.length) errors.push(`${difficulty} contains duplicate words`)
    if (words.some((word) => !/^[a-z]+(?:'[a-z]+)?$/.test(word))) {
      errors.push(`${difficulty} contains a non-lowercase word`)
    }
  }

  return errors
}
