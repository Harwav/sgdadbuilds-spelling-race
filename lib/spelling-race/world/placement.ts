import * as THREE from 'three'
import type { LandmarkPlacement } from './types'

export function routeTransform(curve: THREE.CatmullRomCurve3, placement: LandmarkPlacement): THREE.Matrix4 {
  const point = curve.getPointAt(placement.progress)
  const tangent = curve.getTangentAt(placement.progress).normalize()
  const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
  const position = point.addScaledVector(right, placement.lateral)
  position.y += placement.elevation
  const rotation = new THREE.Euler(0, Math.atan2(tangent.x, tangent.z) + placement.yaw, 0)
  return new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3().setScalar(placement.scale))
}
