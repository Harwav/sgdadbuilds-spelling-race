import * as THREE from 'three'
import type { GrandPrixPalette } from '../kartModel'

type Owned = { materials: Set<THREE.Material>; geometries: Set<THREE.BufferGeometry> }

function g<T extends THREE.BufferGeometry>(geo: T, o: Owned): T { o.geometries.add(geo); return geo }
function m<T extends THREE.Material>(mat: T, o: Owned): T { o.materials.add(mat); return mat }

/**
 * Marina Bay Sands — three tapering towers connected by a SkyPark boat deck.
 * Real height: ~207m. In-game target: ~18 units.
 */
export function createMarinaBaySands(palette: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const towerH = 18
  const gap = 2.8
  const positions = [-gap, 0, gap]

  // Tower materials
  const towerMat = m(new THREE.MeshStandardMaterial({
    color: palette.concrete, roughness: 0.4, metalness: 0.55,
  }), o)
  const glassMat = m(new THREE.MeshStandardMaterial({
    color: palette.window, roughness: 0.12, metalness: 0.65,
  }), o)

  // Build each tower — curved taper via stacked boxes
  positions.forEach((x) => {
    const tower = new THREE.Group()
    tower.name = `mbs-tower-${x.toFixed(0)}`
    const segments = 8
    for (let s = 0; s < segments; s++) {
      const t = s / segments
      const y = t * towerH
      const segH = towerH / segments
      // Width tapers from 1.2 at base to 0.55 at top
      const w = 1.2 - t * 0.65
      const d = 0.9 - t * 0.4
      const segGeo = g(new THREE.BoxGeometry(w, segH, d), o)
      const segMesh = new THREE.Mesh(segGeo, towerMat)
      segMesh.position.set(0, y + segH / 2, 0)
      segMesh.castShadow = true
      segMesh.receiveShadow = true
      tower.add(segMesh)

      // Glass stripe on front face
      const glassGeo = g(new THREE.PlaneGeometry(w * 0.8, segH * 0.5), o)
      const glassPanel = new THREE.Mesh(glassGeo, glassMat)
      glassPanel.position.set(0, y + segH / 2, d / 2 + 0.02)
      tower.add(glassPanel)
    }
    tower.position.set(x, 0, 0)
    root.add(tower)
  })

  // SkyPark boat deck
  const deckMat = m(new THREE.MeshStandardMaterial({
    color: palette.rail, roughness: 0.25, metalness: 0.75,
  }), o)
  const deckLen = gap * 2 + 1.4 // spans all three towers plus overhang
  const deckW = 1.0
  const deckH = 0.4
  const deck = new THREE.Mesh(g(new THREE.BoxGeometry(deckLen, deckH, deckW), o), deckMat)
  deck.position.set(0, towerH - 0.8, 0)
  deck.castShadow = true
  deck.receiveShadow = true
  root.add(deck)

  // Cantilever observation deck (the iconic forward overhang)
  const cantilever = new THREE.Mesh(
    g(new THREE.BoxGeometry(deckLen * 0.5, deckH * 0.8, deckW * 1.8), o),
    deckMat,
  )
  cantilever.position.set(0, towerH - 0.6, deckW * 0.6)
  cantilever.castShadow = true
  root.add(cantilever)

  // Infinity pool edge — thin blue strip along the cantilever
  const poolMat = m(new THREE.MeshStandardMaterial({
    color: palette.shophouseAqua, roughness: 0.05, metalness: 0.3, emissive: palette.shophouseAqua, emissiveIntensity: 0.15,
  }), o)
  const poolEdge = new THREE.Mesh(
    g(new THREE.BoxGeometry(deckLen * 0.46, 0.06, 0.12), o),
    poolMat,
  )
  poolEdge.position.set(0, towerH - 0.4, deckW * 1.4)
  root.add(poolEdge)

  return root
}

/**
 * Gardens by the Bay Supertree — a single iconic tree-like vertical garden structure.
 * Heights vary from 25-50m real; in-game: 7-14 units.
 * @param targetHeight Total height in world units (excluding canopy)
 */
export function createSupertree(targetHeight: number, palette: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const trunkH = targetHeight * 0.75
  const canopyR = targetHeight * 0.22
  const canopyH = targetHeight * 0.25

  // Trunk — concrete core tapering upward
  const trunkMat = m(new THREE.MeshStandardMaterial({
    color: palette.concrete, roughness: 0.55, metalness: 0.3,
  }), o)

  // Tapered trunk using cylinder
  const trunkRadius = 0.28
  const topRadius = 0.12
  const trunk = new THREE.Mesh(
    g(new THREE.CylinderGeometry(topRadius, trunkRadius, trunkH, 8), o),
    trunkMat,
  )
  trunk.position.y = trunkH / 2
  trunk.castShadow = true
  trunk.receiveShadow = true
  root.add(trunk)

  // Lattice ribs around the trunk — wireframe-like vertical strips
  const ribMat = m(new THREE.MeshStandardMaterial({
    color: palette.hdbCoral, roughness: 0.35, metalness: 0.5,
  }), o)
  const ribCount = 8
  for (let i = 0; i < ribCount; i++) {
    const angle = (i / ribCount) * Math.PI * 2
    const ribGeo = g(new THREE.BoxGeometry(0.04, trunkH * 0.85, 0.06), o)
    const rib = new THREE.Mesh(ribGeo, ribMat)
    const r = trunkRadius * 0.7
    rib.position.set(Math.cos(angle) * r, trunkH * 0.45, Math.sin(angle) * r)
    rib.rotation.y = -angle
    root.add(rib)
  }

  // Canopy — wireframe dome
  const canopyMat = m(new THREE.MeshStandardMaterial({
    color: palette.treeCanopy, roughness: 0.5, metalness: 0.4,
    emissive: palette.treeCanopy, emissiveIntensity: 0.2,
  }), o)

  // Main canopy disc
  const canopy = new THREE.Mesh(
    g(new THREE.CylinderGeometry(canopyR * 0.3, canopyR, canopyH, 12, 1, true), o),
    canopyMat,
  )
  canopy.position.y = trunkH + canopyH / 2
  canopy.castShadow = true
  root.add(canopy)

  // Canopy top cap
  const cap = new THREE.Mesh(
    g(new THREE.CylinderGeometry(0, canopyR * 0.35, canopyH * 0.4, 12), o),
    canopyMat,
  )
  cap.position.y = trunkH + canopyH
  root.add(cap)

  // Radial canopy ribs
  const ribCount2 = 10
  for (let i = 0; i < ribCount2; i++) {
    const angle = (i / ribCount2) * Math.PI * 2
    const ribLen = canopyR * 0.85
    const ribGeo2 = g(new THREE.BoxGeometry(0.03, 0.05, ribLen), o)
    const rib2 = new THREE.Mesh(ribGeo2, ribMat)
    rib2.position.set(
      Math.cos(angle) * ribLen * 0.5,
      trunkH + canopyH * 0.6,
      Math.sin(angle) * ribLen * 0.5,
    )
    rib2.rotation.y = -angle
    rib2.rotation.x = -0.5 // tilt downward
    root.add(rib2)
  }

  // Planter box at base
  const planterMat = m(new THREE.MeshStandardMaterial({
    color: palette.hdbMint, roughness: 0.5, metalness: 0.3,
  }), o)
  const planter = new THREE.Mesh(
    g(new THREE.CylinderGeometry(trunkRadius + 0.15, trunkRadius + 0.25, 0.5, 8), o),
    planterMat,
  )
  planter.position.y = 0.25
  root.add(planter)

  return root
}

/**
 * Singapore Flyer — giant observation wheel.
 * Real height: ~165m. In-game target: ~16 units.
 */
export function createSingaporeFlyer(palette: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const wheelR = 7.5
  const hubY = wheelR + 1.5

  // A-frame support legs
  const legMat = m(new THREE.MeshStandardMaterial({
    color: palette.rail, roughness: 0.3, metalness: 0.7,
  }), o)
  const legHeight = hubY * 0.7
  const legSpread = 3.5

  // Left and right A-frame leg pairs
  for (const sign of [-1, 1]) {
    const legGeo = g(new THREE.CylinderGeometry(0.25, 0.45, legHeight, 6), o)
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(sign * legSpread, legHeight / 2, 0)
    leg.rotation.z = sign * 0.35
    leg.castShadow = true
    root.add(leg)

    // Second leg of the A (angled inward)
    const leg2 = new THREE.Mesh(legGeo, legMat)
    leg2.position.set(sign * legSpread * 0.6, legHeight / 2, sign * 2.5)
    leg2.rotation.z = sign * 0.2
    leg2.rotation.x = sign * 0.3
    leg2.castShadow = true
    root.add(leg2)
  }

  // Hub axle
  const hubMat = m(new THREE.MeshStandardMaterial({
    color: palette.gantry, roughness: 0.2, metalness: 0.8,
  }), o)
  const hub = new THREE.Mesh(
    g(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), o),
    hubMat,
  )
  hub.position.y = hubY
  hub.rotation.z = Math.PI / 2
  root.add(hub)

  // Wheel rim — torus
  const rimMat = m(new THREE.MeshStandardMaterial({
    color: palette.gantryPost, roughness: 0.25, metalness: 0.75,
  }), o)
  const rim = new THREE.Mesh(
    g(new THREE.TorusGeometry(wheelR, 0.22, 8, 48), o),
    rimMat,
  )
  rim.position.y = hubY
  rim.rotation.x = Math.PI / 2
  rim.castShadow = true
  root.add(rim)

  // Inner rim
  const innerRim = new THREE.Mesh(
    g(new THREE.TorusGeometry(wheelR * 0.88, 0.15, 8, 48), o),
    rimMat,
  )
  innerRim.position.y = hubY
  innerRim.rotation.x = Math.PI / 2
  root.add(innerRim)

  // Spokes
  const spokeMat = m(new THREE.MeshStandardMaterial({
    color: palette.rail, roughness: 0.3, metalness: 0.8,
  }), o)
  const spokeCount = 24
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2
    const spoke = new THREE.Mesh(
      g(new THREE.CylinderGeometry(0.05, 0.05, wheelR * 0.92, 6), o),
      spokeMat,
    )
    spoke.position.y = hubY
    spoke.rotation.z = Math.PI / 2
    spoke.rotation.y = angle
    spoke.position.x = Math.cos(angle) * wheelR * 0.46
    spoke.position.z = Math.sin(angle) * wheelR * 0.46
    root.add(spoke)
  }

  // Capsule pods around the rim
  const capsuleMat = m(new THREE.MeshStandardMaterial({
    color: palette.hdbCoral, roughness: 0.3, metalness: 0.4,
  }), o)
  const capsuleCount = 16
  for (let i = 0; i < capsuleCount; i++) {
    const angle = (i / capsuleCount) * Math.PI * 2
    const capsule = new THREE.Mesh(
      g(new THREE.CapsuleGeometry(0.25, 0.6, 4, 8), o),
      capsuleMat,
    )
    capsule.position.set(
      Math.cos(angle) * wheelR,
      hubY,
      Math.sin(angle) * wheelR,
    )
    capsule.rotation.z = Math.PI / 2
    capsule.rotation.y = -angle + Math.PI / 2
    root.add(capsule)
  }

  // Base platform
  const baseMat = m(new THREE.MeshStandardMaterial({
    color: palette.concrete, roughness: 0.6, metalness: 0.2,
  }), o)
  const base = new THREE.Mesh(
    g(new THREE.BoxGeometry(legSpread * 2.5, 0.4, 5), o),
    baseMat,
  )
  base.position.y = 0.2
  base.receiveShadow = true
  root.add(base)

  return root
}
