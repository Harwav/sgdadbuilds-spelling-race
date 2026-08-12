import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  countVisibleShadowCasters,
  createSignBoardRectProjector,
  projectGantryDisplay,
} from '@/components/spelling-race/world/visualDiagnostics'

describe('visual diagnostics geometry', () => {
  it('fits a DOM display to its four physical corners', () => {
    const rect = projectGantryDisplay([
      new THREE.Vector3(-1, 1, -8), new THREE.Vector3(1, 1, -8),
      new THREE.Vector3(-1, -1, -8), new THREE.Vector3(1, -1, -8),
    ], testCamera(), 400, 200)
    expect(rect?.width).toBeGreaterThan(0)
    expect(rect?.height).toBeGreaterThan(0)
  })
  it('projects actual frame vertices into finite container pixels enclosing the sign anchor', () => {
    const frame = asymmetricFrame()
    const anchor = new THREE.Object3D()
    anchor.position.set(-2, 0, 0)
    frame.add(anchor)
    frame.position.z = -5
    frame.updateMatrixWorld(true)
    const camera = testCamera()
    const projector = createSignBoardRectProjector(frame)

    const rect = projector.project(camera, 400, 200)
    expect(rect).toEqual({
      left: expect.closeTo(140, 5),
      top: expect.closeTo(80, 5),
      right: expect.closeTo(180, 5),
      bottom: expect.closeTo(120, 5),
    })
    expect(Object.values(rect!).every(Number.isFinite)).toBe(true)

    const projectedAnchor = anchor.getWorldPosition(new THREE.Vector3()).project(camera)
    const anchorX = (projectedAnchor.x * 0.5 + 0.5) * 400
    const anchorY = (-projectedAnchor.y * 0.5 + 0.5) * 200
    expect(anchorX).toBeGreaterThan(rect!.left)
    expect(anchorX).toBeLessThan(rect!.right)
    expect(anchorY).toBeGreaterThan(rect!.top)
    expect(anchorY).toBeLessThan(rect!.bottom)

    const original = { ...rect! }
    expect(projector.project(camera, 800, 400)).toEqual({
      left: expect.closeTo(original.left * 2, 5),
      top: expect.closeTo(original.top * 2, 5),
      right: expect.closeTo(original.right * 2, 5),
      bottom: expect.closeTo(original.bottom * 2, 5),
    })
  })

  it('returns null when the frame is behind the camera', () => {
    const frame = asymmetricFrame()
    frame.position.z = 5
    frame.updateMatrixWorld(true)

    expect(createSignBoardRectProjector(frame).project(testCamera(), 400, 200)).toBeNull()
  })

  it('returns null when the projected frame is outside the container viewport', () => {
    const frame = asymmetricFrame()
    frame.position.set(100, 0, -5)
    frame.updateMatrixWorld(true)

    expect(createSignBoardRectProjector(frame).project(testCamera(), 400, 200)).toBeNull()
  })

  it('returns null when the frame geometry is unprojectable', () => {
    const frame = new THREE.Mesh(new THREE.BufferGeometry())
    frame.position.z = -5
    frame.updateMatrixWorld(true)

    expect(createSignBoardRectProjector(frame).project(testCamera(), 400, 200)).toBeNull()
  })

  it('counts only shadow-casting meshes in visible hierarchies', () => {
    const scene = new THREE.Scene()
    scene.add(mesh({ castShadow: true }))
    scene.add(mesh({ castShadow: false }))
    scene.add(mesh({ castShadow: true, visible: false }))

    const hiddenParent = new THREE.Group()
    hiddenParent.visible = false
    hiddenParent.add(mesh({ castShadow: true }))
    scene.add(hiddenParent)

    const visibleParent = new THREE.Group()
    visibleParent.add(mesh({ castShadow: true }))
    scene.add(visibleParent)

    expect(countVisibleShadowCasters(scene)).toBe(2)
  })
})

function asymmetricFrame(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -3, -1, 0,
    -1, -1, 0,
    -1, 1, 0,
    -3, 1, 0,
  ], 3))
  return new THREE.Mesh(geometry)
}

function testCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 2, 0.1, 100)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

function mesh(input: { castShadow: boolean; visible?: boolean }): THREE.Mesh {
  const value = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
  value.castShadow = input.castShadow
  value.visible = input.visible ?? true
  return value
}
