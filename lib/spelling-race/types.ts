export type SpellingWord = {
  id: string
  word: string
  sentence?: string
  aliases?: string[]
}

export type LocalWordList = {
  version: 1
  title: string
  words: SpellingWord[]
}

export type Difficulty = 'rookie' | 'racer' | 'champion'
export type KartColour = 'red' | 'yellow' | 'teal' | 'purple'
export type SteeringMode = 'tilt' | 'touch'
export type RacePlacement = 1 | 2 | 3 | 4
export type SightWordResult = {
  word: string
  outcome: 'accepted' | 'timeout' | 'assisted' | 'skipped' | 'deferred'
  elapsedMs: number | null
}
export type RaceRecap = { placement: RacePlacement; fastestWords: string[]; practiceWords: string[] }

export type VoiceGateState =
  | 'ready'
  | 'permission-needed'
  | 'permission-denied'
  | 'unsupported'
  | 'service-error'
  | 'listening-interrupted'

export type RaceRoundKind = 'say-word' | 'missing-letters' | 'use-in-sentence'

export type RaceCard = {
  id: string
  wordId: string
  kind: RaceRoundKind
  prompt: string
  expectedWord: string
  expectedLetters: string[]
  sentence: string
  attempts: number
  clueLevel: 0 | 1 | 2
}

export type MatchResult =
  | { outcome: 'accepted'; match: 'exact' | 'close' }
  | { outcome: 'retry'; reason: 'empty' | 'different-word' | 'letters-mismatch' | 'sentence-missing-word' }
