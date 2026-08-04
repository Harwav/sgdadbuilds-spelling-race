import { doubleMetaphone } from 'double-metaphone'

export function isStrongPhoneticVariant(target: string, candidate: string): boolean {
  if (
    target.length < 5
    || candidate.includes(' ')
    || target[0] !== candidate[0]
    || editDistance(target, candidate) > 2
  ) return false
  const targetCodes = new Set(doubleMetaphone(target).filter(Boolean))
  return doubleMetaphone(candidate).filter(Boolean).some((code) => targetCodes.has(code))
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
