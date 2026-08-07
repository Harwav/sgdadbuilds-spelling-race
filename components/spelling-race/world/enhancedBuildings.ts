import * as THREE from 'three'
import type { GrandPrixPalette } from '../kartModel'

export type BuildingStyle = 'glass-tower' | 'twin-tower' | 'stepped' | 'block' | 'slender'

type Owned = { materials: Set<THREE.Material>; geometries: Set<THREE.BufferGeometry> }

function g<T extends THREE.BufferGeometry>(geo: T, o: Owned): T { o.geometries.add(geo); return geo }
function m<T extends THREE.Material>(mat: T, o: Owned): T { o.materials.add(mat); return mat }

export function createEnhancedBuilding(
  style: BuildingStyle, baseWidth: number, height: number,
  palette: GrandPrixPalette, o: Owned,
): THREE.Group {
  switch (style) {
    case 'glass-tower': return glassTower(baseWidth, height, palette, o)
    case 'twin-tower': return twinTower(baseWidth, height, palette, o)
    case 'stepped': return steppedTower(baseWidth, height, palette, o)
    case 'block': return blockTower(baseWidth, height, palette, o)
    case 'slender': return slenderTower(baseWidth, height, palette, o)
  }
}

function glassTower(w: number, h: number, p: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const d = w * 0.7
  const coreMat = m(new THREE.MeshStandardMaterial({ color: p.concrete, roughness: 0.45, metalness: 0.5 }), o)
  const core = new THREE.Mesh(g(new THREE.BoxGeometry(w, h, d), o), coreMat)
  core.position.y = h / 2
  core.receiveShadow = true; core.castShadow = true
  root.add(core)

  const glassMat = m(new THREE.MeshStandardMaterial({ color: p.window, roughness: 0.15, metalness: 0.6 }), o)
  const panelGeo = g(new THREE.PlaneGeometry(w * 0.88, 0.45), o)
  const panels = Math.floor(h / 0.65)
  for (let i = 0; i < panels; i++) {
    const fp = new THREE.Mesh(panelGeo, glassMat)
    fp.position.set(0, 0.55 + i * 0.65, d / 2 + 0.02)
    root.add(fp)
    const bp = new THREE.Mesh(panelGeo, glassMat)
    bp.position.set(0, 0.55 + i * 0.65, -d / 2 - 0.02)
    bp.rotation.y = Math.PI
    root.add(bp)
  }
  const roof = new THREE.Mesh(g(new THREE.BoxGeometry(w * 0.5, 0.3, d * 0.5), o),
    m(new THREE.MeshStandardMaterial({ color: p.rail, roughness: 0.3, metalness: 0.7 }), o))
  roof.position.y = h + 0.15
  root.add(roof)
  return root
}

function twinTower(w: number, h: number, p: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const d = w * 0.6, gap = w * 1.1
  const glassMat = m(new THREE.MeshStandardMaterial({ color: p.window, roughness: 0.12, metalness: 0.65 }), o)
  const bodyMat = m(new THREE.MeshStandardMaterial({ color: p.concrete, roughness: 0.4, metalness: 0.5 }), o)
  const panelGeo = g(new THREE.PlaneGeometry(w * 0.8, 0.4), o)
  const panels = Math.floor(h / 0.6)
  ;[-1, 1].forEach((side) => {
    const tower = new THREE.Mesh(g(new THREE.BoxGeometry(w, h, d), o), bodyMat)
    tower.position.set(side * gap / 2, h / 2, 0)
    tower.castShadow = true; tower.receiveShadow = true
    root.add(tower)
    for (let i = 0; i < panels; i++) {
      const pn = new THREE.Mesh(panelGeo, glassMat)
      pn.position.set(side * gap / 2, 0.5 + i * 0.6, d / 2 + 0.01)
      root.add(pn)
    }
  })
  const bridge = new THREE.Mesh(g(new THREE.BoxGeometry(gap, 0.35, d * 0.7), o),
    m(new THREE.MeshStandardMaterial({ color: p.rail, roughness: 0.25, metalness: 0.8 }), o))
  bridge.position.y = h * 0.6
  bridge.castShadow = true
  root.add(bridge)
  return root
}

function steppedTower(w: number, h: number, p: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const d = w * 0.65
  const glassMat = m(new THREE.MeshStandardMaterial({ color: p.barrierTeal, roughness: 0.15, metalness: 0.55 }), o)
  const accentMat = m(new THREE.MeshStandardMaterial({ color: p.rail, roughness: 0.3, metalness: 0.6 }), o)
  const sections = [
    { w: w, h: h * 0.4, y: h * 0.2 },
    { w: w * 0.8, h: h * 0.3, y: h * 0.55 },
    { w: w * 0.55, h: h * 0.3, y: h * 0.85 },
  ]
  sections.forEach((s) => {
    const mesh = new THREE.Mesh(g(new THREE.BoxGeometry(s.w, s.h, d), o), accentMat)
    mesh.position.y = s.y
    mesh.castShadow = true; mesh.receiveShadow = true
    root.add(mesh)
    const ring = new THREE.Mesh(g(new THREE.BoxGeometry(s.w * 0.9, 0.15, d * 1.05), o), glassMat)
    ring.position.y = s.y - s.h / 2 + 0.08
    root.add(ring)
  })
  const ant = new THREE.Mesh(g(new THREE.CylinderGeometry(0.06, 0.06, h * 0.15, 6), o), accentMat)
  ant.position.y = h
  root.add(ant)
  return root
}

function blockTower(w: number, h: number, p: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const d = w * 0.5, wideW = w * 1.6
  const bodyMat = m(new THREE.MeshStandardMaterial({ color: p.hdbCream, roughness: 0.35, metalness: 0.4 }), o)
  const core = new THREE.Mesh(g(new THREE.BoxGeometry(wideW, h, d), o), bodyMat)
  core.position.y = h / 2
  core.castShadow = true; core.receiveShadow = true
  root.add(core)
  const glassMat = m(new THREE.MeshStandardMaterial({ color: p.window, roughness: 0.1, metalness: 0.7 }), o)
  const stripeGeo = g(new THREE.BoxGeometry(wideW * 0.95, 0.22, d * 0.1), o)
  const bands = Math.floor(h / 0.75)
  for (let i = 0; i < bands; i++) {
    const stripe = new THREE.Mesh(stripeGeo, glassMat)
    stripe.position.set(0, 0.6 + i * 0.75, d / 2 + 0.01)
    root.add(stripe)
  }
  return root
}

function slenderTower(w: number, h: number, p: GrandPrixPalette, o: Owned): THREE.Group {
  const root = new THREE.Group()
  const nw = w * 0.55, d = w * 0.55
  const bodyMat = m(new THREE.MeshStandardMaterial({ color: p.hdbMint, roughness: 0.3, metalness: 0.5 }), o)
  const core = new THREE.Mesh(g(new THREE.BoxGeometry(nw, h, d), o), bodyMat)
  core.position.y = h / 2
  core.castShadow = true; core.receiveShadow = true
  root.add(core)
  const glassMat = m(new THREE.MeshStandardMaterial({ color: p.shophouseAqua, roughness: 0.1, metalness: 0.7 }), o)
  const stripeGeo = g(new THREE.BoxGeometry(nw * 0.2, h * 0.85, d * 0.1), o)
  for (let x = -nw * 0.3; x <= nw * 0.3; x += nw * 0.25) {
    const stripe = new THREE.Mesh(stripeGeo, glassMat)
    stripe.position.set(x, h / 2, d / 2 + 0.01)
    root.add(stripe)
  }
  const spire = new THREE.Mesh(g(new THREE.ConeGeometry(0.12, h * 0.12, 6), o),
    m(new THREE.MeshStandardMaterial({ color: p.rail, roughness: 0.2, metalness: 0.8 }), o))
  spire.position.y = h + h * 0.06
  root.add(spire)
  return root
}

export function pickBuildingStyle(seed: number): BuildingStyle {
  const styles: BuildingStyle[] = ['glass-tower', 'twin-tower', 'stepped', 'block', 'slender']
  return styles[seed % styles.length]
}

export function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash
}
