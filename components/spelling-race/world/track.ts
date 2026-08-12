import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { worldLapFraction } from '@/lib/spelling-race/world/progress'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import { createTrackEnvelope, type TrackEnvelope } from '@/lib/spelling-race/world/trackEnvelope'
import type { WorldMaterials } from './materials'

const TRACK_SEGMENTS = 160
const KERB_SEGMENTS = 72
const BARRIER_SEGMENTS = 48

export type TrackWorld = {
  curve: THREE.CatmullRomCurve3
  root: THREE.Group
  halfWidth: number
  envelope: TrackEnvelope
}

export type TrackSample = {
  point: THREE.Vector3
  tangent: THREE.Vector3
  right: THREE.Vector3
}

export function createTrackWorld(card: RouteCard, materials: WorldMaterials): TrackWorld {
  const envelope = createTrackEnvelope(card)
  const curve = envelope.curve
  const root = new THREE.Group()
  root.name = 'track-world'

  const ground = new THREE.Mesh(new THREE.CircleGeometry(108, 72), materials.grass)
  ground.name = 'track-ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.18
  ground.receiveShadow = true
  root.add(ground)

  const road = new THREE.Mesh(createTrackStrip(envelope, -envelope.tokens.asphaltHalfWidth, envelope.tokens.asphaltHalfWidth, TRACK_SEGMENTS), materials.asphalt)
  road.name = 'track-asphalt'
  road.receiveShadow = true
  root.add(road)

  addBands(root, envelope, materials)
  addStartGrid(root, curve, card.circuit.halfWidth, materials)
  return { curve, root, halfWidth: card.circuit.halfWidth, envelope }
}

export function sampleTrack(track: TrackWorld, progress: number, lateral: number, out: TrackSample): TrackSample {
  const surface = track.envelope.surfaceAt(worldLapFraction(progress), clamp(lateral, -1, 1) * track.envelope.tokens.kartHalfWidth)
  out.point.copy(surface.point)
  out.tangent.copy(surface.tangent)
  out.right.copy(surface.right)
  return out
}

export function placeOnTrack(object: THREE.Object3D, track: TrackWorld, progress: number, lateral: number, out: TrackSample): void {
  sampleTrack(track, progress, lateral, out)
  object.position.copy(out.point)
  object.rotation.y = Math.atan2(out.tangent.x, out.tangent.z)
}

function createTrackStrip(envelope: TrackEnvelope, innerOffset: number, outerOffset: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const outer = envelope.surfaceAt(t, outerOffset)
    const inner = envelope.surfaceAt(t, innerOffset)
    positions.push(outer.point.x, outer.point.y, outer.point.z)
    positions.push(inner.point.x, inner.point.y, inner.point.z)
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

function addBands(root: THREE.Group, envelope: TrackEnvelope, materials: WorldMaterials): void {
  const kerbs = new THREE.Group()
  kerbs.name = 'track-kerbs'
  for (const side of [-1, 1] as const) {
    const mesh = new THREE.Mesh(
      createTrackStrip(envelope, side * envelope.tokens.kerbInnerOffset, side * envelope.tokens.kerbOuterOffset, KERB_SEGMENTS),
      side < 0 ? materials.kerbRed : materials.kerbWhite,
    )
    mesh.position.y = 0.06
    mesh.receiveShadow = true
    kerbs.add(mesh)
  }
  const runoff = new THREE.Group()
  runoff.name = 'track-runoff'
  for (const side of [-1, 1] as const) {
    runoff.add(new THREE.Mesh(
      createTrackStrip(envelope, side * envelope.tokens.kerbOuterOffset, side * envelope.tokens.runoffOuterOffset, KERB_SEGMENTS),
      materials.roadMarking,
    ))
  }
  const barriers = new THREE.Group()
  barriers.name = 'track-barriers'
  addBarriers(barriers, envelope, materials)
  root.add(kerbs, runoff, barriers)
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

function addBarriers(root: THREE.Group, envelope: TrackEnvelope, materials: WorldMaterials): void {
  const geometry = new RoundedBoxGeometry(0.72, 0.58, 2.8, 3, 0.16)
  const teal = new THREE.InstancedMesh(geometry, materials.barrierTeal, BARRIER_SEGMENTS)
  const yellow = new THREE.InstancedMesh(geometry, materials.barrierYellow, BARRIER_SEGMENTS)
  teal.name = 'track-barrier-teal'
  yellow.name = 'track-barrier-yellow'
  teal.castShadow = true
  teal.receiveShadow = true
  yellow.castShadow = true
  yellow.receiveShadow = true

  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3(1, 1, 1)
  const matrix = new THREE.Matrix4()
  const rotation = new THREE.Euler()
  let tealIndex = 0
  let yellowIndex = 0

  for (let index = 0; index < BARRIER_SEGMENTS; index += 1) {
    const t = index / BARRIER_SEGMENTS

    for (const side of [-1, 1]) {
      const sample = envelope.surfaceAt(t, side * (envelope.tokens.barrierInnerOffset + 0.36))
      position.copy(sample.point)
      position.y += 0.29
      rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0)
      quaternion.setFromEuler(rotation)
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
