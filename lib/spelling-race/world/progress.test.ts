import { describe, expect, it } from 'vitest'
import { WORLD_UNITS_PER_LAP, worldLapFraction, worldProgressAt } from './progress'

describe('Grand Prix world progress', () => {
  it('keeps simulation and rendering on the exact 1,000-unit lap scale', () => {
    expect(WORLD_UNITS_PER_LAP).toBe(1_000)
    expect(worldProgressAt(0.055)).toBe(55)
    expect(worldLapFraction(1_250)).toBe(0.25)
    expect(worldLapFraction(-250)).toBe(0.75)
  })
})
