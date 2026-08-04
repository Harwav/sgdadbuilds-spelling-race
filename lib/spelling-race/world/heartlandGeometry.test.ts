import path from 'node:path'
import { NodeIO, type Node } from '@gltf-transform/core'
import { describe, expect, it } from 'vitest'

describe('Singapore hawker production geometry', () => {
  it('keeps the warm lights over the open stall frontage instead of behind the roof slab', async () => {
    const document = await new NodeIO().read(path.join(
      process.cwd(),
      'public/spelling-race/assets/models/hawker-centre.glb',
    ))
    const lights = bounds(document.getRoot().listNodes().find((node) => node.getName() === 'ceiling_light_housings'))
    const stalls = bounds(document.getRoot().listNodes().find((node) => node.getName() === 'stall_rhythm'))
    const roof = bounds(document.getRoot().listNodes().find((node) => node.getName() === 'roof_profile'))

    expect(lights.maximumZ).toBeLessThan(stalls.maximumZ)
    expect(lights.minimumY).toBeGreaterThan(stalls.maximumY)
    expect(roof.maximumY - roof.minimumY).toBeLessThanOrEqual(1.5)
  })
})

function bounds(node: Node | undefined): {
  minimumY: number
  maximumY: number
  maximumZ: number
} {
  const positions = node?.getMesh()?.listPrimitives()[0]?.getAttribute('POSITION')?.getArray()
  if (!positions) throw new Error(`Missing production geometry for ${node?.getName() ?? 'unknown node'}`)

  let minimumY = Number.POSITIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  let maximumZ = Number.NEGATIVE_INFINITY
  for (let index = 0; index < positions.length; index += 3) {
    minimumY = Math.min(minimumY, positions[index + 1])
    maximumY = Math.max(maximumY, positions[index + 1])
    maximumZ = Math.max(maximumZ, positions[index + 2])
  }
  return { minimumY, maximumY, maximumZ }
}
