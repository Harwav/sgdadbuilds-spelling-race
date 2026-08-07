import type { KartColour, RacePlacement } from './types'
import { WORLD_UNITS_PER_LAP } from './world/progress'

export const RACE_LAPS = 3
export { WORLD_UNITS_PER_LAP as TRACK_LENGTH } from './world/progress'

const FINISH_DISTANCE = RACE_LAPS * WORLD_UNITS_PER_LAP
const PLAYER_SPEED = 25
const GRASS_FACTOR = 0.55
const BOOST_SPEED_FACTOR = 0.5
const BOOST_DECAY_PER_SECOND = 0.8
const LATERAL_SPEED = 0.75

export type RaceKart = {
  colour: KartColour
  progress: number
  lateralPosition: number
  boost: number
  finishedAtSeconds: number | null
}

export type RaceRival = {
  id: 1 | 2 | 3
  colour: KartColour
  progress: number
  speed: number
  finishedAtSeconds: number | null
}

export const KART_COLOURS: readonly KartColour[] = ['red', 'yellow', 'teal', 'purple']

export function rivalColoursFor(playerColour: KartColour): readonly KartColour[] {
  return KART_COLOURS.filter((colour) => colour !== playerColour)
}

export type RaceState = {
  player: RaceKart
  rivals: readonly RaceRival[]
  elapsedSeconds: number
  finished: boolean
  placement: RacePlacement
  speedModifier: number
  handlingModifier: number
}

export function createRace(input: { playerColour: KartColour; seed: number; speedModifier?: number; handlingModifier?: number }): RaceState {
  const random = seededRandom(input.seed)
  const rivalColours = rivalColoursFor(input.playerColour)
  return {
    player: { colour: input.playerColour, progress: 0, lateralPosition: 0, boost: 0, finishedAtSeconds: null },
    rivals: [1, 2, 3].map((id, index) => ({
      id: id as RaceRival['id'],
      colour: rivalColours[index],
      progress: 0,
      speed: 24 + random() * 3,
      finishedAtSeconds: null,
    })),
    elapsedSeconds: 0,
    finished: false,
    placement: 1,
    speedModifier: input.speedModifier ?? 0,
    handlingModifier: input.handlingModifier ?? 0,
  }
}

export function stepRace(state: RaceState, input: { deltaSeconds: number; steering: number }): RaceState {
  if (state.finished) return state

  const deltaSeconds = Math.max(0, input.deltaSeconds)
  const lateralSpeed = LATERAL_SPEED * (1 + state.handlingModifier)
  const lateralPosition = clamp(
    state.player.lateralPosition + clamp(input.steering, -1, 1) * lateralSpeed * deltaSeconds,
    -1,
    1,
  )
  const grassFactor = Math.abs(lateralPosition) >= 0.7 ? GRASS_FACTOR : 1
  const playerSpeed = PLAYER_SPEED * (1 + state.player.boost * BOOST_SPEED_FACTOR + state.speedModifier) * grassFactor
  const playerProgress = Math.min(FINISH_DISTANCE, state.player.progress + playerSpeed * deltaSeconds)
  const player = {
    ...state.player,
    progress: playerProgress,
    lateralPosition,
    boost: Math.max(0, state.player.boost - BOOST_DECAY_PER_SECOND * deltaSeconds),
    finishedAtSeconds: state.player.finishedAtSeconds ?? crossingTime(
      state.player.progress,
      playerProgress,
      playerSpeed,
      state.elapsedSeconds,
    ),
  }
  const rivals = state.rivals.map((rival) => ({
    ...rival,
    progress: Math.min(FINISH_DISTANCE, rival.progress + rival.speed * deltaSeconds),
    finishedAtSeconds: rival.finishedAtSeconds ?? crossingTime(
      rival.progress,
      Math.min(FINISH_DISTANCE, rival.progress + rival.speed * deltaSeconds),
      rival.speed,
      state.elapsedSeconds,
    ),
  }))
  const placement = playerPlacement(player, rivals)
  const finished = player.finishedAtSeconds !== null

  return {
    ...state,
    player,
    rivals,
    elapsedSeconds: state.elapsedSeconds + deltaSeconds,
    finished,
    placement,
  }
}

export function applyBoost(state: RaceState, ratio: number): RaceState {
  return {
    ...state,
    player: { ...state.player, boost: clamp(state.player.boost + ratio, 0, 1) },
  }
}

function playerPlacement(player: RaceKart, rivals: readonly RaceRival[]): RacePlacement {
  if (player.finishedAtSeconds !== null) {
    return (1 + rivals.filter((rival) => rival.finishedAtSeconds !== null && rival.finishedAtSeconds < player.finishedAtSeconds!).length) as RacePlacement
  }
  return (1 + rivals.filter((rival) => rival.progress > player.progress).length) as RacePlacement
}

function crossingTime(progress: number, nextProgress: number, speed: number, elapsedSeconds: number): number | null {
  if (nextProgress < FINISH_DISTANCE || speed <= 0) return null
  return elapsedSeconds + (FINISH_DISTANCE - progress) / speed
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
