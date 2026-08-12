export type VisualKartPose = { readonly id: string | number; readonly progress: number; readonly lateral: number }

export function resolveVisualKartPoses(
  requested: readonly VisualKartPose[],
  options: { readonly minProgressGap: number; readonly lateralBounds: readonly [number, number] },
): readonly VisualKartPose[] {
  const ordered = requested
    .map((pose, index) => ({ ...pose, progress: wrap(pose.progress), index }))
    .sort((a, b) => a.progress - b.progress || a.index - b.index)
  const result: VisualKartPose[] = []
  let previousProgress = Number.NEGATIVE_INFINITY

  for (const pose of ordered) {
    const progress = Math.max(pose.progress, previousProgress + options.minProgressGap)
    result.push({
      id: pose.id,
      progress: wrap(progress),
      lateral: clamp(pose.lateral, options.lateralBounds[0], options.lateralBounds[1]),
    })
    previousProgress = progress
  }
  return result
}

function wrap(value: number): number {
  return ((value % 1) + 1) % 1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
