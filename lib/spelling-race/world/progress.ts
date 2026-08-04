export const WORLD_UNITS_PER_LAP = 1_000

export function worldProgressAt(lapFraction: number): number {
  return lapFraction * WORLD_UNITS_PER_LAP
}

export function worldLapFraction(progress: number): number {
  return positiveModulo(progress, WORLD_UNITS_PER_LAP) / WORLD_UNITS_PER_LAP
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
