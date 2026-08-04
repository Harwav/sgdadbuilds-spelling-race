import type { MatchResult, RaceCard, SpellingWord } from './types'
import { BUILT_IN_PRONUNCIATION_SIGNATURES, HOMOPHONE_CANDIDATES } from './phoneticLexicon'
import { isStrongPhoneticVariant } from './phoneticMatcher'

const homophoneCandidates: Readonly<Record<string, readonly string[]>> = HOMOPHONE_CANDIDATES
const pronunciationSignatures: Readonly<Record<string, readonly string[]>> = BUILT_IN_PRONUNCIATION_SIGNATURES

const LETTER_NAMES: Record<string, string> = {
  a: 'a', ay: 'a',
  b: 'b', be: 'b', bee: 'b',
  c: 'c', see: 'c', sea: 'c',
  d: 'd', dee: 'd',
  e: 'e', ee: 'e',
  f: 'f', ef: 'f',
  g: 'g', gee: 'g',
  h: 'h', aitch: 'h',
  i: 'i', eye: 'i',
  j: 'j', jay: 'j',
  k: 'k', kay: 'k',
  l: 'l', el: 'l',
  m: 'm', em: 'm',
  n: 'n', en: 'n',
  o: 'o', oh: 'o',
  p: 'p', pea: 'p',
  q: 'q', queue: 'q', cue: 'q',
  r: 'r', are: 'r',
  s: 's', ess: 's',
  t: 't', tea: 't', tee: 't',
  u: 'u', you: 'u',
  v: 'v', vee: 'v',
  w: 'w', doubleyou: 'w',
  x: 'x', ex: 'x',
  y: 'y', why: 'y',
  z: 'z', zee: 'z', zed: 'z',
}

export function normaliseTranscript(value: string): string {
  return value.toLowerCase().replace(/[^a-z\s'-]/g, '').trim().replace(/\s+/g, ' ')
}

export function spokenLetters(value: string): string[] {
  return normaliseTranscript(value)
    .replace(/[\s'-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => LETTER_NAMES[token] ?? '')
    .filter(Boolean)
}

export type SightWordMatch =
  | { outcome: 'accepted'; match: 'exact' | 'phonetic'; detected: string }
  | { outcome: 'retry'; reason: 'different-word'; detected: string | null }

export function evaluateSightWordAnswer(
  target: string,
  candidates: readonly string[],
  isFinal = true,
): SightWordMatch | null {
  const expected = normaliseTranscript(target)
  const normalisedCandidates = candidates.map(normaliseTranscript).filter(Boolean)

  const exact = normalisedCandidates.find((candidate) => candidate === expected)
  if (exact) return { outcome: 'accepted', match: 'exact', detected: exact }
  if (!isFinal) return null

  for (const candidate of normalisedCandidates) {
    if (homophoneCandidates[expected]?.includes(candidate)) {
      return { outcome: 'accepted', match: 'phonetic', detected: candidate }
    }
  }

  for (const candidate of normalisedCandidates) {
    const candidateSignatures = pronunciationSignatures[candidate]
    if (candidateSignatures) {
      if (pronunciationSignatures[expected]?.some((signature) => candidateSignatures.includes(signature))) {
        return { outcome: 'accepted', match: 'phonetic', detected: candidate }
      }
      continue
    }

    if (isStrongPhoneticVariant(expected, candidate)) {
      return { outcome: 'accepted', match: 'phonetic', detected: candidate }
    }
  }

  return { outcome: 'retry', reason: 'different-word', detected: normalisedCandidates[0] ?? null }
}

export function evaluateRaceAnswer(
  card: Pick<RaceCard, 'kind'> & Partial<Pick<RaceCard, 'expectedWord' | 'expectedLetters'>>,
  transcript: string,
  word: SpellingWord,
): MatchResult {
  const normalised = normaliseTranscript(transcript)

  if (!normalised) return { outcome: 'retry', reason: 'empty' }

  if (card.kind === 'missing-letters') {
    return sameLetters(spokenLetters(normalised), card.expectedLetters ?? [])
      ? { outcome: 'accepted', match: 'exact' }
      : { outcome: 'retry', reason: 'letters-mismatch' }
  }

  const expectedWord = normaliseTranscript(word.word)
  const aliases = new Set((word.aliases ?? []).map(normaliseTranscript))
  const tokens = normalised.split(' ')
  const hasExpectedWord = tokens.includes(expectedWord)
  const hasAlias = tokens.some((token) => aliases.has(token))

  if (card.kind === 'use-in-sentence') {
    return tokens.length >= 2 && (hasExpectedWord || hasAlias)
      ? { outcome: 'accepted', match: hasExpectedWord ? 'exact' : 'close' }
      : { outcome: 'retry', reason: 'sentence-missing-word' }
  }

  if (hasExpectedWord) return { outcome: 'accepted', match: 'exact' }
  if (hasAlias) return { outcome: 'accepted', match: 'close' }
  if (tokens.length === 1 && word.word.length >= 5 && editDistance(tokens[0], word.word) === 1) {
    return { outcome: 'accepted', match: 'close' }
  }

  return { outcome: 'retry', reason: 'different-word' }
}

function sameLetters(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((letter, index) => letter === expected[index])
}

function editDistance(first: string, second: string): number {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex]
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = first[firstIndex - 1] === second[secondIndex - 1]
        ? previous[secondIndex - 1]
        : Math.min(previous[secondIndex], current[secondIndex - 1], previous[secondIndex - 1]) + 1
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[second.length]
}
