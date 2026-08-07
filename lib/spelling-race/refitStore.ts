// Module-level in-memory store for the Refit (kart upgrade) system.
// Keeps everything in memory — matches the privacy model from the README.

export type RefitSnapshot = {
  readonly skippedWords: readonly string[]
  readonly speedModifier: number
  readonly handlingModifier: number
  readonly refitCompletions: number
  /** How many words correctly read toward the next boost (0–2). Persists across navigation. */
  readonly refitProgress: number
}

type Listener = () => void

let skippedWords: string[] = []
let speedModifier = 0
let handlingModifier = 0
let refitCompletions = 0
let refitProgress = 0
const listeners = new Set<Listener>()

function read(): RefitSnapshot {
  return { skippedWords, speedModifier, handlingModifier, refitCompletions, refitProgress }
}

function emit(): void {
  for (const fn of listeners) fn()
}

export const refitStore = {
  read,

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  /** Merge newly-skipped words into the store. Duplicates are ignored. */
  addSkippedWords(words: readonly string[]): void {
    const existing = new Set(skippedWords)
    let changed = false
    for (const w of words) {
      if (!existing.has(w)) {
        existing.add(w)
        skippedWords = [...skippedWords, w]
        changed = true
      }
    }
    if (changed) emit()
  },

  /** Remove a word after it has been successfully read in the refit screen. */
  removeSkippedWord(word: string): void {
    const next = skippedWords.filter((w) => w !== word)
    if (next.length !== skippedWords.length) {
      skippedWords = next
      emit()
    }
  },

  /**
   * Record one correctly-read word toward the next boost.
   * Returns true if this completed a round (3 words) and triggered a speed upgrade.
   */
  incrementProgress(): { roundCompleted: boolean; snapshot: RefitSnapshot } {
    refitProgress += 1
    if (refitProgress >= 3) {
      refitProgress = 0
      speedModifier = Math.min(0.25, speedModifier + 0.05)
      handlingModifier = Math.min(0.25, handlingModifier + 0.05)
      refitCompletions += 1
      emit()
      return { roundCompleted: true, snapshot: read() }
    }
    emit()
    return { roundCompleted: false, snapshot: read() }
  },

  getSkippedWordCount(): number {
    return skippedWords.length
  },
}
