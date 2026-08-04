import { describe, expect, it } from 'vitest'
import { applyBoost, createRace, RACE_LAPS, stepRace, TRACK_LENGTH } from './raceSimulation'

describe('race simulation', () => {
  it('creates deterministic rivals from the same seed', () => {
    expect(createRace({ playerColour: 'teal', seed: 42 })).toEqual(createRace({ playerColour: 'teal', seed: 42 }))
  })

  it('assigns the three unselected kart colours to deterministic rivals', () => {
    expect(createRace({ playerColour: 'red', seed: 42 }).rivals.map((rival) => rival.colour)).toEqual([
      'yellow',
      'teal',
      'purple',
    ])
  })

  it('has a baseline three-lap duration of about two minutes', () => {
    const race = createRace({ playerColour: 'red', seed: 1 })
    const elapsed = stepRace(race, { deltaSeconds: 120, steering: 0 })

    expect(elapsed.player.progress).toBe(RACE_LAPS * TRACK_LENGTH)
  })

  it('slows automatic progress when steering onto grass', () => {
    const race = createRace({ playerColour: 'red', seed: 7 })
    const road = stepRace(race, { deltaSeconds: 2, steering: 0 })
    const grass = stepRace(race, { deltaSeconds: 2, steering: 1 })

    expect(grass.player.progress).toBeLessThan(road.player.progress)
    expect(grass.player.lateralPosition).toBeGreaterThan(0)
  })

  it('caps boosts while preserving a proportional speed advantage', () => {
    const race = createRace({ playerColour: 'yellow', seed: 3 })
    const boosted = applyBoost(applyBoost(race, 1), 1)

    expect(boosted.player.boost).toBe(1)
    expect(stepRace(boosted, { deltaSeconds: 1, steering: 0 }).player.progress).toBeGreaterThan(
      stepRace(race, { deltaSeconds: 1, steering: 0 }).player.progress,
    )
  })

  it('finishes after three laps and ranks a genuine win first', () => {
    const race = createRace({ playerColour: 'purple', seed: 1 })
    const nearFinish = {
      ...race,
      player: { ...race.player, progress: RACE_LAPS * TRACK_LENGTH - 5 },
      rivals: race.rivals.map((rival, index) => ({ ...rival, progress: 2_800 - index * 100 })),
    }

    const finished = stepRace(nearFinish, { deltaSeconds: 1, steering: 0 })

    expect(finished.player.progress).toBe(RACE_LAPS * TRACK_LENGTH)
    expect(finished.finished).toBe(true)
    expect(finished.placement).toBe(1)
  })

  it('keeps racing after a rival crosses first and ends with the genuine loss', () => {
    const race = createRace({ playerColour: 'purple', seed: 1 })
    const nearFinish = {
      ...race,
      player: { ...race.player, progress: RACE_LAPS * TRACK_LENGTH - 30 },
      rivals: race.rivals.map((rival, index) => ({
        ...rival,
        progress: index === 0 ? RACE_LAPS * TRACK_LENGTH - 1 : 2_700 - index * 100,
      })),
    }

    const rivalFinished = stepRace(nearFinish, { deltaSeconds: 1, steering: 0 })
    const finished = stepRace(rivalFinished, { deltaSeconds: 1, steering: 0 })

    expect(rivalFinished).toMatchObject({ finished: false, placement: 2 })
    expect(finished).toMatchObject({ finished: true, placement: 2 })
  })
})
