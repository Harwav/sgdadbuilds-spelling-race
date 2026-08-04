import { STARTER_LIST } from './starterPack'
import type { LocalWordList } from './types'

export const WORD_LIST_STORAGE_KEY = 'sgdadbuilds.spelling-race.word-list.v1'
export const WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)?$/i

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>

export function normaliseWord(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function validateWordList(words: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const normalised = words.map(normaliseWord)

  if (words.length < 3) errors.push('Add at least 3 words.')
  if (words.length > 20) errors.push('Use no more than 20 words.')

  if (new Set(normalised).size !== normalised.length) errors.push('Words must be unique.')

  for (const word of normalised) {
    if (!WORD_PATTERN.test(word)) {
      errors.push(`“${word}” is not a single English word.`)
    } else if (word.length < 2 || word.length > 20) {
      errors.push(`“${word}” must be 2–20 characters.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function saveWordList(storage: StorageAdapter, list: LocalWordList): void {
  storage.setItem(WORD_LIST_STORAGE_KEY, JSON.stringify(list))
}

export function loadWordList(storage: Pick<Storage, 'getItem'>): LocalWordList | null {
  const stored = storage.getItem(WORD_LIST_STORAGE_KEY)
  if (!stored) return null

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!isLocalWordList(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function resetToStarterList(storage: StorageAdapter): LocalWordList {
  saveWordList(storage, STARTER_LIST)
  return STARTER_LIST
}

function isLocalWordList(value: unknown): value is LocalWordList {
  if (!value || typeof value !== 'object') return false
  const list = value as Partial<LocalWordList>
  return list.version === 1 && typeof list.title === 'string' && Array.isArray(list.words)
}
