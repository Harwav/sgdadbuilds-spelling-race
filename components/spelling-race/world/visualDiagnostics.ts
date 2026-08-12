import * as THREE from 'three'

export type SignBoardRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type GantryDisplayRect = { left: number; top: number; width: number; height: number }

export function projectGantryDisplay(
  corners: readonly THREE.Vector3[], camera: THREE.Camera, width: number, height: number,
): GantryDisplayRect | null {
  if (corners.length !== 4 || width <= 0 || height <= 0) return null
  const cameraPoint = new THREE.Vector3()
  const projected = new THREE.Vector3()
  const pixels = corners.map((corner) => {
    cameraPoint.copy(corner).applyMatrix4(camera.matrixWorldInverse)
    if (cameraPoint.z >= 0) return null
    projected.copy(corner).project(camera)
    return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height }
  })
  if (pixels.some((pixel) => pixel === null)) return null
  const visible = pixels as Array<{ x: number; y: number }>
  const left = Math.max(0, Math.min(...visible.map((pixel) => pixel.x)))
  const top = Math.max(0, Math.min(...visible.map((pixel) => pixel.y)))
  const right = Math.min(width, Math.max(...visible.map((pixel) => pixel.x)))
  const bottom = Math.min(height, Math.max(...visible.map((pixel) => pixel.y)))
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null
}

export type SignBoardRectProjector = {
  project(camera: THREE.Camera, width: number, height: number): SignBoardRect | null
}

export function createSignBoardRectProjector(frame: THREE.Mesh): SignBoardRectProjector {
  const position = frame.geometry.getAttribute('position')
  const worldPoint = new THREE.Vector3()
  const cameraPoint = new THREE.Vector3()
  const rect: SignBoardRect = { left: 0, top: 0, right: 0, bottom: 0 }

  return {
    project(camera, width, height) {
      if (!position || position.count === 0 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null
      }

      let left = Number.POSITIVE_INFINITY
      let top = Number.POSITIVE_INFINITY
      let right = Number.NEGATIVE_INFINITY
      let bottom = Number.NEGATIVE_INFINITY

      for (let index = 0; index < position.count; index += 1) {
        worldPoint
          .set(position.getX(index), position.getY(index), position.getZ(index))
          .applyMatrix4(frame.matrixWorld)
        cameraPoint.copy(worldPoint).applyMatrix4(camera.matrixWorldInverse)
        if (!Number.isFinite(cameraPoint.x) || !Number.isFinite(cameraPoint.y) || !Number.isFinite(cameraPoint.z) || cameraPoint.z >= 0) {
          return null
        }

        worldPoint.copy(cameraPoint).applyMatrix4(camera.projectionMatrix)
        const x = (worldPoint.x * 0.5 + 0.5) * width
        const y = (-worldPoint.y * 0.5 + 0.5) * height
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }

      if (right < 0 || bottom < 0 || left > width || top > height) return null
      rect.left = left
      rect.top = top
      rect.right = right
      rect.bottom = bottom
      return rect
    },
  }
}

export function countVisibleShadowCasters(root: THREE.Object3D): number {
  let count = 0
  root.traverseVisible((object) => {
    if (object instanceof THREE.Mesh && object.castShadow) count += 1
  })
  return count
}
