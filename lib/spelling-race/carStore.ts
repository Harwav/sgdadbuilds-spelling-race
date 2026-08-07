// Module-level in-memory store for the Car Collection (vehicle unlock) system.
// Keeps everything in memory — matches the privacy model from the README.

import { CAR_CHALLENGE_WORDS, CAR_CHALLENGE_WORD_COUNT } from './carWords'

/** The 5 unlockable car model IDs. */
export const CAR_IDS = ['car-sports-1', 'car-sports-2', 'car-sports-3', 'car-sports-4', 'car-sports-5'] as const
export type CarId = (typeof CAR_IDS)[number]

export const CAR_NAMES: Record<CarId, string> = {
  'car-sports-1': 'Crimson Streak',
  'car-sports-2': 'Summit Rover',
  'car-sports-3': 'Urban Glider',
  'car-sports-4': 'Amber Flash',
  'car-sports-5': 'Neon Phantom',
}

export type CarStoreSnapshot = {
  readonly unlockedCars: readonly CarId[]
  readonly equippedCar: CarId | null
  /** How many words correctly read toward the current unlock (0–4). */
  readonly unlockProgress: number
  /** Which car is currently being challenged for unlock (null if idle). */
  readonly activeCar: CarId | null
}

type Listener = () => void

let unlockedCars: CarId[] = []
let equippedCar: CarId | null = null
let unlockProgress = 0
let activeCar: CarId | null = null
let usedWords: Set<string> = new Set()
const listeners = new Set<Listener>()

function read(): CarStoreSnapshot {
  return { unlockedCars, equippedCar, unlockProgress, activeCar }
}

function pickRandomWords(pool: readonly string[], count: number): readonly string[] {
  const arr = [...pool]
  const result: string[] = []
  for (let i = 0; i < count && arr.length > 0; i++) {
    const index = Math.floor(Math.random() * arr.length)
    result.push(arr[index])
    arr.splice(index, 1)
  }
  return result
}

function emit(): void {
  for (const fn of listeners) fn()
}

export const carStore = {
  read,

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  /** Begin unlocking a car — generates the challenge. Caller generates words externally. */
  startUnlock(carId: CarId): void {
    activeCar = carId
    unlockProgress = 0
    emit()
  },

  /** Record one correctly-read word. Returns true if all 5 words completed. */
  recordWord(): { completed: boolean; snapshot: CarStoreSnapshot } {
    unlockProgress += 1
    if (unlockProgress >= 5) {
      unlockedCars = [...unlockedCars, activeCar!]
      if (!equippedCar) equippedCar = activeCar
      const justUnlocked = activeCar!
      activeCar = null
      unlockProgress = 0
      emit()
      return { completed: true, snapshot: read() }
    }
    emit()
    return { completed: false, snapshot: read() }
  },

  /** Cancel the current unlock attempt. */
  cancelUnlock(): void {
    activeCar = null
    unlockProgress = 0
    emit()
  },

  /** Equip an already-unlocked car. Pass null to go back to default kart. */
  equipCar(carId: CarId | null): void {
    equippedCar = carId
    emit()
  },

  /** Check if a car is unlocked. */
  isUnlocked(carId: CarId): boolean {
    return unlockedCars.includes(carId)
  },

  /** Record words used in a successful unlock — they won't appear again. */
  markWordsUsed(words: readonly string[]): void {
    for (const word of words) usedWords.add(word)
  },

  /** Pick `count` fresh challenge words, excluding previously used ones.
   *  If not enough fresh words remain the used set is reset so every car
   *  can always be unlocked. */
  pickChallengeWords(count: number = CAR_CHALLENGE_WORD_COUNT): readonly string[] {
    const fresh = CAR_CHALLENGE_WORDS.filter((w) => !usedWords.has(w))
    if (fresh.length < count) {
      usedWords = new Set()
      return pickRandomWords([...CAR_CHALLENGE_WORDS], count)
    }
    return pickRandomWords(fresh, count)
  },
}