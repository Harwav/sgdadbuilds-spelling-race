import * as THREE from 'three'
import type { TrackEnvelope } from '@/lib/spelling-race/world/trackEnvelope'

const REQUIRED_NODES = [
  'display_surface', 'display_top_left', 'display_top_right', 'display_bottom_left', 'display_bottom_right',
  'sign_anchor', 'pylon_left_foot', 'pylon_right_foot', 'signal-listening',
] as const

export function createRaceGantry(envelope: TrackEnvelope): THREE.Group {
  const root = new THREE.Group()
  root.name = 'race-gantry'
  root.userData.signalState = 'listening'
  const width = envelope.tokens.barrierInnerOffset * 2 + 1.8
  const teal = new THREE.MeshStandardMaterial({ color: '#147d82', roughness: 0.38, metalness: 0.2 })
  const charcoal = new THREE.MeshStandardMaterial({ color: '#17212b', roughness: 0.42, metalness: 0.35 })
  const glow = new THREE.MeshStandardMaterial({ color: '#fff1c4', emissive: '#c9963c', emissiveIntensity: 0.7 })

  for (const [side, name] of [[-1, 'pylon_left_foot'], [1, 'pylon_right_foot']] as const) {
    const pylon = namedMesh(name, new THREE.BoxGeometry(1.3, 5.2, 1.15), teal)
    pylon.position.set(side * width / 2, 2.6, 0)
    root.add(pylon)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.35), charcoal)
    cap.position.set(side * width / 2, 5.2, 0)
    root.add(cap)
  }

  const truss = namedMesh('gantry-truss', new THREE.BoxGeometry(width, 0.38, 0.6), charcoal)
  truss.position.y = 5.35
  root.add(truss)
  for (const x of [-width * 0.31, -width * 0.16, width * 0.16, width * 0.31]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.25, 0.28), charcoal)
    brace.position.set(x, 4.75, 0)
    brace.rotation.z = x < 0 ? -0.65 : 0.65
    root.add(brace)
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.28, 1.25), charcoal)
  canopy.position.y = 6.15
  root.add(canopy)

  const display = namedMesh('display_surface', new THREE.BoxGeometry(width * 0.42, 1.45, 0.18), glow)
  display.position.set(0, 5.28, 0.12)
  root.add(display)
  addDisplayAnchors(root, display)
  for (const x of [-width * 0.26, width * 0.26]) {
    for (const [index, colour] of ['#ec5555', '#f0c55a', '#60d18d'].entries()) {
      const lamp = namedMesh(index === 1 && x < 0 ? 'signal-listening' : `signal-${x}-${index}`, new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: index === 1 ? 0.9 : 0.15 }))
      lamp.position.set(x + (index - 1) * 0.45, 4.72, 0.22)
      root.add(lamp)
    }
  }
  return root
}

export function validateRaceGantry(gantry: THREE.Group): readonly string[] {
  return REQUIRED_NODES.filter((name) => !gantry.getObjectByName(name)).map((name) => `Missing gantry node: ${name}`)
}

function namedMesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function addDisplayAnchors(root: THREE.Group, display: THREE.Mesh): void {
  const corners = [
    ['display_top_left', -1, 1], ['display_top_right', 1, 1],
    ['display_bottom_left', -1, -1], ['display_bottom_right', 1, -1],
  ] as const
  for (const [name, x, y] of corners) {
    const anchor = new THREE.Object3D()
    anchor.name = name
    anchor.position.set(display.position.x + x * 0.45 * (display.geometry as THREE.BoxGeometry).parameters.width, display.position.y + y * 0.45 * (display.geometry as THREE.BoxGeometry).parameters.height, 0.24)
    root.add(anchor)
  }
  const anchor = new THREE.Object3D()
  anchor.name = 'sign_anchor'
  anchor.position.copy(display.position)
  anchor.position.z = 0.24
  root.add(anchor)
}
