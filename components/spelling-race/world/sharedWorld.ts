import * as THREE from 'three'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import type { GrandPrixPalette } from '../kartModel'
import { createWorldMaterials, type WorldMaterials } from './materials'
import { createTrackWorld, type TrackWorld } from './track'

export const HIGH_SPEED_STREAKS = 18
export const HIGH_BOOST_PARTICLES = 12

export type SpeedStreaks = {
  readonly lines: THREE.LineSegments
  readonly positions: Float32Array
}

export type BoostParticles = {
  readonly mesh: THREE.InstancedMesh
}

export type SharedWorld = {
  readonly root: THREE.Group
  readonly track: TrackWorld
  readonly materials: WorldMaterials
  readonly background: THREE.Color
  readonly fog: THREE.Fog
  readonly sun: THREE.DirectionalLight
  readonly gantry: THREE.Group
  readonly speedStreaks: SpeedStreaks
  readonly boostParticles: BoostParticles
}

export type WorldDisposalScope = {
  defer(dispose: () => void): void
  dispose(): void
}

export function createWorldDisposalScope(): WorldDisposalScope {
  const disposers: Array<() => void> = []
  let disposed = false

  return {
    defer(dispose) {
      if (disposed) {
        try { dispose() } catch { /* Cleanup remains best-effort after the scope closes. */ }
        return
      }
      disposers.push(dispose)
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (let index = disposers.length - 1; index >= 0; index -= 1) {
        try { disposers[index]() } catch { /* Continue so later resources and leases are still released. */ }
      }
      disposers.length = 0
    },
  }
}

export function runWorldInitialization(
  scope: WorldDisposalScope,
  initialize: () => void,
  onFailure: () => void,
): boolean {
  try {
    initialize()
    return true
  } catch {
    scope.dispose()
    onFailure()
    return false
  }
}

export function createSharedWorld(input: {
  card: RouteCard
  assets: LoadedWorldAssets
  palette: GrandPrixPalette
}): SharedWorld {
  const { card, assets, palette } = input
  const materials = createWorldMaterials(palette, assets)
  const track = createTrackWorld(card, materials)
  const root = new THREE.Group()
  root.name = 'shared-world'
  root.add(track.root)
  addGrandstands(root, materials)
  addHills(root, materials)
  addTrees(root, materials)

  const ambient = new THREE.AmbientLight(palette.ambient, 1.65)
  root.add(ambient)
  const sun = createSun(palette)
  root.add(sun)

  const gantry = createGantry(materials)
  root.add(gantry)
  const speedStreaks = createSpeedStreaks(materials)
  root.add(speedStreaks.lines)
  const boostParticles = createBoostParticles(materials)
  root.add(boostParticles.mesh)

  return {
    root,
    track,
    materials,
    background: new THREE.Color(palette.sky),
    fog: new THREE.Fog(palette.sky, 34, 112),
    sun,
    gantry,
    speedStreaks,
    boostParticles,
  }
}

export function configureSharedWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, world: SharedWorld): void {
  scene.background = world.background
  scene.fog = world.fog
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  scene.add(world.root)
}

export function updateSpeedStreaks(
  effect: SpeedStreaks,
  playerPoint: THREE.Vector3,
  tangent: THREE.Vector3,
  right: THREE.Vector3,
  time: number,
  activeCount: number,
): void {
  const { positions } = effect
  for (let index = 0; index < HIGH_SPEED_STREAKS; index += 1) {
    const offset = index * 6
    if (index >= activeCount) {
      positions.fill(0, offset, offset + 6)
      continue
    }

    const lane = ((index % 7) - 3) * 0.72
    const phase = positiveModulo(time * 13 + index * 1.73, 7)
    const behind = 2.4 + phase
    const x = playerPoint.x + right.x * lane - tangent.x * behind
    const z = playerPoint.z + right.z * lane - tangent.z * behind
    const y = 0.28 + (index % 3) * 0.21
    positions[offset] = x
    positions[offset + 1] = y
    positions[offset + 2] = z
    positions[offset + 3] = x - tangent.x * 1.5
    positions[offset + 4] = y
    positions[offset + 5] = z - tangent.z * 1.5
  }
  const attribute = effect.lines.geometry.getAttribute('position') as THREE.BufferAttribute
  attribute.needsUpdate = true
}

export function updateBoostParticles(
  mesh: THREE.InstancedMesh,
  playerPoint: THREE.Vector3,
  tangent: THREE.Vector3,
  right: THREE.Vector3,
  time: number,
  activeCount: number,
  matrix: THREE.Matrix4,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: THREE.Vector3,
): void {
  for (let index = 0; index < HIGH_BOOST_PARTICLES; index += 1) {
    if (index >= activeCount) {
      scale.setScalar(0)
      matrix.compose(playerPoint, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
      continue
    }

    const phase = positiveModulo(time * 5.5 + index * 0.59, 1)
    const lateral = Math.sin(index * 2.2) * 0.65 * phase
    position.copy(playerPoint).addScaledVector(tangent, -(1.4 + phase * 4.5))
    position.addScaledVector(right, lateral)
    position.y = 0.45 + (index % 3) * 0.18
    scale.setScalar(0.45 + (1 - phase) * 0.7)
    matrix.compose(position, quaternion, scale)
    mesh.setMatrixAt(index, matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

function createSun(palette: GrandPrixPalette): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(palette.sun, 2.5)
  sun.position.set(-24, 42, -18)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -48
  sun.shadow.camera.right = 48
  sun.shadow.camera.top = 48
  sun.shadow.camera.bottom = -48
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 110
  sun.shadow.bias = -0.0005
  return sun
}

function addGrandstands(root: THREE.Group, materials: WorldMaterials): void {
  const seatGeometry = new THREE.BoxGeometry(0.62, 0.5, 0.62)
  const seatMatrices = materials.grandstandSeats.map(() => [] as THREE.Matrix4[])
  for (const [x, z, rotation] of [[-22, -17, 0.45], [24, 15, -0.6]] as const) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(12, 2.4, 4.2), materials.grandstand)
    base.position.set(x, 1.2, z)
    base.rotation.y = rotation
    base.receiveShadow = true
    root.add(base)

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(13, 0.48, 5.1), materials.grandstandCanopy)
    canopy.position.set(x, 4.2, z)
    canopy.rotation.y = rotation
    root.add(canopy)

    for (let row = 0; row < 2; row += 1) {
      for (let seat = 0; seat < 12; seat += 1) {
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(x - 4.8 + seat * 0.86, 2.65 + row * 0.58, z - 0.7 + row * 1.2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0)),
          new THREE.Vector3(1, 1, 1),
        )
        seatMatrices[(seat + row) % materials.grandstandSeats.length].push(matrix)
      }
    }
  }

  seatMatrices.forEach((matrices, materialIndex) => {
    const seats = new THREE.InstancedMesh(seatGeometry, materials.grandstandSeats[materialIndex], matrices.length)
    seats.name = `grandstand-seats-${materialIndex + 1}`
    matrices.forEach((matrix, index) => seats.setMatrixAt(index, matrix))
    seats.instanceMatrix.needsUpdate = true
    root.add(seats)
  })
}

function addHills(root: THREE.Group, materials: WorldMaterials): void {
  const hillGeometry = new THREE.SphereGeometry(1, 32, 18)
  const hills = [
    { position: [-70, 2, -50], scale: [28, 8, 24], dark: true },
    { position: [68, 1, -46], scale: [31, 9, 23], dark: false },
    { position: [-68, 0, 54], scale: [34, 8, 28], dark: false },
    { position: [70, 2, 50], scale: [30, 9, 27], dark: true },
  ] as const

  hills.forEach((hill) => {
    const mesh = new THREE.Mesh(hillGeometry, hill.dark ? materials.grassShadow : materials.grass)
    mesh.position.set(hill.position[0], hill.position[1], hill.position[2])
    mesh.scale.set(hill.scale[0], hill.scale[1], hill.scale[2])
    mesh.receiveShadow = true
    root.add(mesh)
  })
}

function addTrees(root: THREE.Group, materials: WorldMaterials): void {
  const treePositions = [
    [-57, -34], [-61, -8], [-55, 28], [-38, 51], [-7, 56], [26, 52],
    [56, 31], [61, 5], [58, -25], [37, -51], [4, -57], [-29, -53],
  ] as const
  const trunkGeometry = new THREE.CylinderGeometry(0.38, 0.55, 2.7, 12)
  const crownGeometry = new THREE.SphereGeometry(1.75, 20, 14)

  treePositions.forEach(([x, z], index) => {
    const treeScale = 0.8 + (index % 3) * 0.13
    const trunk = new THREE.Mesh(trunkGeometry, materials.treeTrunk)
    trunk.position.set(x, 1.15 * treeScale, z)
    trunk.scale.setScalar(treeScale)

    const crown = new THREE.Mesh(crownGeometry, materials.treeCanopy)
    crown.position.set(x, 3.45 * treeScale, z)
    crown.scale.set(treeScale, treeScale * 1.12, treeScale)
    root.add(trunk, crown)
  })
}

function createGantry(materials: WorldMaterials): THREE.Group {
  const gantry = new THREE.Group()
  for (const x of [-7.05, 7.05]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.05, 5.3, 1.05), materials.gantryPost)
    post.position.set(x, 2.65, 0)
    gantry.add(post)

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.15), materials.gantryCap)
    cap.position.set(x, 5.15, 0)
    gantry.add(cap)
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(14.8, 2.35, 0.85), materials.gantryFrame)
  beam.position.y = 5.7
  beam.castShadow = true
  gantry.add(beam)
  const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.22, 0.28), materials.gantryFrame)
  lowerRail.position.set(0, 4.15, 0)
  gantry.add(lowerRail)
  return gantry
}

function createSpeedStreaks(materials: WorldMaterials): SpeedStreaks {
  const positions = new Float32Array(HIGH_SPEED_STREAKS * 2 * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return { lines: new THREE.LineSegments(geometry, materials.speedStreak), positions }
}

function createBoostParticles(materials: WorldMaterials): BoostParticles {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 8, 6),
    materials.boostParticle,
    HIGH_BOOST_PARTICLES,
  )
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return { mesh }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
