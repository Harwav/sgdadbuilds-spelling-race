import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { worldLapFraction } from '@/lib/spelling-race/world/progress'
import { createRouteCurve } from '@/lib/spelling-race/world/routes'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import type { WorldMaterials } from './materials'

const TRACK_SEGMENTS = 160
const KERB_SEGMENTS = 72
const BARRIER_SEGMENTS = 48

export type TrackWorld = {
  curve: THREE.CatmullRomCurve3
  root: THREE.Group
  halfWidth: number
}

export type TrackSample = {
  point: THREE.Vector3
  tangent: THREE.Vector3
  right: THREE.Vector3
}

export function createTrackWorld(card: RouteCard, materials: WorldMaterials): TrackWorld {
  const curve = createRouteCurve(card)
  const root = new THREE.Group()
  root.name = 'track-world'

  const ground = new THREE.Mesh(new THREE.CircleGeometry(108, 72), materials.grass)
  ground.name = 'track-ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.18
  ground.receiveShadow = true
  root.add(ground)

  const road = new THREE.Mesh(createTrackStrip(curve, card.circuit.halfWidth, TRACK_SEGMENTS), materials.asphalt)
  road.name = 'track-asphalt'
  road.receiveShadow = true
  root.add(road)

  addKerbs(root, curve, card.circuit.halfWidth, materials)
  addBarriers(root, curve, card.circuit.halfWidth, materials)
  addStartGrid(root, curve, card.circuit.halfWidth, materials)
  return { curve, root, halfWidth: card.circuit.halfWidth }
}

export function sampleTrack(track: TrackWorld, progress: number, lateral: number, out: TrackSample): TrackSample {
  const trackProgress = worldLapFraction(progress)
  track.curve.getPointAt(trackProgress, out.point)
  track.curve.getTangentAt(trackProgress, out.tangent).normalize()
  out.right.set(out.tangent.z, 0, -out.tangent.x).normalize()
  out.point.addScaledVector(out.right, clamp(lateral, -1, 1) * (track.halfWidth - 1.2))
  return out
}

export function placeOnTrack(object: THREE.Object3D, track: TrackWorld, progress: number, lateral: number, out: TrackSample): void {
  sampleTrack(track, progress, lateral, out)
  object.position.copy(out.point)
  object.rotation.y = Math.atan2(out.tangent.x, out.tangent.z)
}

function createTrackStrip(curve: THREE.CatmullRomCurve3, halfWidth: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    curve.getPointAt(t, point)
    curve.getTangentAt(t, tangent).normalize()
    right.set(tangent.z, 0, -tangent.x).normalize()
    positions.push(point.x + right.x * halfWidth, 0, point.z + right.z * halfWidth)
    positions.push(point.x - right.x * halfWidth, 0, point.z - right.z * halfWidth)
    uvs.push(1, t * 10, 0, t * 10)

    if (index < segments) {
      const start = index * 2
      indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function addStartGrid(root: THREE.Group, track: THREE.CatmullRomCurve3, halfWidth: number, materials: WorldMaterials): void {
  const group = new THREE.Group()
  group.name = 'track-start-grid'
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()
  track.getPointAt(0, point)
  track.getTangentAt(0, tangent).normalize()
  right.set(tangent.z, 0, -tangent.x).normalize()

  const lineGeometry = new THREE.BoxGeometry(halfWidth * 2 - 1.1, 0.05, 0.62)
  for (const offset of [0, -1.6, -3.2]) {
    const line = new THREE.Mesh(lineGeometry, materials.roadMarking)
    line.position.copy(point).addScaledVector(tangent, offset)
    line.position.y = 0.055
    line.rotation.y = Math.atan2(tangent.x, tangent.z)
    group.add(line)
  }

  const gridGeometry = new THREE.BoxGeometry(1.2, 0.04, 2.1)
  for (const lane of [-0.42, 0.05, 0.52]) {
    const grid = new THREE.Mesh(gridGeometry, materials.roadMarking)
    grid.position.copy(point).addScaledVector(tangent, -2.25).addScaledVector(right, lane * (halfWidth - 1.6))
    grid.position.y = 0.05
    grid.rotation.y = Math.atan2(tangent.x, tangent.z)
    group.add(grid)
  }
  root.add(group)
}

function addKerbs(root: THREE.Group, track: THREE.CatmullRomCurve3, halfWidth: number, materials: WorldMaterials): void {
  const geometry = new THREE.BoxGeometry(3.8, 0.16, 0.72)
  const red = new THREE.InstancedMesh(geometry, materials.kerbRed, KERB_SEGMENTS)
  const white = new THREE.InstancedMesh(geometry, materials.kerbWhite, KERB_SEGMENTS)
  red.receiveShadow = true
  white.receiveShadow = true
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Euler()
  let redIndex = 0
  let whiteIndex = 0

  for (let index = 0; index < KERB_SEGMENTS; index += 1) {
    const t = index / KERB_SEGMENTS
    track.getPointAt(t, point)
    track.getTangentAt(t, tangent).normalize()
    right.set(tangent.z, 0, -tangent.x).normalize()
    rotation.set(0, Math.atan2(tangent.x, tangent.z), 0)
    quaternion.setFromEuler(rotation)

    for (const side of [-1, 1]) {
      position.copy(point).addScaledVector(right, side * (halfWidth + 0.25))
      position.y = 0.08
      matrix.compose(position, quaternion, scale)
      const target = index % 2 === 0 ? red : white
      const targetIndex = index % 2 === 0 ? redIndex++ : whiteIndex++
      target.setMatrixAt(targetIndex, matrix)
    }
  }

  red.count = redIndex
  white.count = whiteIndex
  red.instanceMatrix.needsUpdate = true
  white.instanceMatrix.needsUpdate = true
  root.add(red, white)
}

function addBarriers(root: THREE.Group, track: THREE.CatmullRomCurve3, halfWidth: number, materials: WorldMaterials): void {
  const geometry = new RoundedBoxGeometry(2.8, 0.58, 0.72, 3, 0.16)
  const teal = new THREE.InstancedMesh(geometry, materials.barrierTeal, BARRIER_SEGMENTS)
  const yellow = new THREE.InstancedMesh(geometry, materials.barrierYellow, BARRIER_SEGMENTS)
  teal.name = 'track-barrier-teal'
  yellow.name = 'track-barrier-yellow'
  teal.castShadow = true
  teal.receiveShadow = true
  yellow.castShadow = true
  yellow.receiveShadow = true

  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Euler()
  let tealIndex = 0
  let yellowIndex = 0

  for (let index = 0; index < BARRIER_SEGMENTS; index += 1) {
    const t = index / BARRIER_SEGMENTS
    track.getPointAt(t, point)
    track.getTangentAt(t, tangent).normalize()
    right.set(tangent.z, 0, -tangent.x).normalize()
    rotation.set(0, Math.atan2(tangent.x, tangent.z), 0)
    quaternion.setFromEuler(rotation)

    for (const side of [-1, 1]) {
      position.copy(point).addScaledVector(right, side * (halfWidth + 2.25))
      position.y = 0.29
      matrix.compose(position, quaternion, scale)
      const target = index % 2 === 0 ? teal : yellow
      const targetIndex = index % 2 === 0 ? tealIndex++ : yellowIndex++
      target.setMatrixAt(targetIndex, matrix)
    }
  }

  teal.count = tealIndex
  yellow.count = yellowIndex
  teal.instanceMatrix.needsUpdate = true
  yellow.instanceMatrix.needsUpdate = true
  root.add(teal, yellow)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
