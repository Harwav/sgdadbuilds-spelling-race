import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { applyKartPaint, createKartFromTemplate, disposeObject3D, type GrandPrixPalette } from '@/components/spelling-race/kartModel'

describe('shared kart model (Kenney)', () => {
  it('clones and recolours materials by name', () => {
    const template = kartTemplate()
    const originalBodyPaint = findMaterial(template, 'red')
    const originalGlass = findMaterial(template, 'glass')
    const kart = createKartFromTemplate(template, 'teal', palette(), 'player')

    expect(kart).not.toBe(template)
    expect(findMaterial(kart, 'red').color.getStyle()).toBe(new THREE.Color('teal').getStyle())
    expect(findMaterial(kart, 'grey').color.getStyle()).toBe(new THREE.Color('#d4d4d4').getStyle())
    expect(findMaterial(kart, 'carTire').color.getStyle()).toBe(new THREE.Color('#222222').getStyle())
    expect(findMaterial(kart, 'glass').color.getStyle()).toBe(originalGlass.color.getStyle())
    expect(findMaterial(template, 'red')).toBe(originalBodyPaint)
    expect(originalBodyPaint.color.getStyle()).toBe(new THREE.Color('#e85553').getStyle())

    const casts = castingMeshes(kart)
    expect(casts.length).toBeGreaterThanOrEqual(1)
    casts.forEach((mesh) => expect(mesh.castShadow).toBe(true))
  })

  it('repaints without replacing materials or altering glass', () => {
    const paletteValue = palette()
    const kart = createKartFromTemplate(kartTemplate(), 'red', paletteValue, 'garage')
    const bodyBefore = findMaterial(kart, 'red')
    const glassBefore = findMaterial(kart, 'glass').color.getStyle()

    applyKartPaint(kart, 'purple', paletteValue)

    expect(findMaterial(kart, 'red')).toBe(bodyBefore)
    expect(bodyBefore.color.getStyle()).toBe(new THREE.Color('purple').getStyle())
    expect(findMaterial(kart, 'carTire').color.getStyle()).toBe(new THREE.Color('#222222').getStyle())
    expect(findMaterial(kart, 'glass').color.getStyle()).toBe(glassBefore)
    expect(kart.userData.kartColour).toBe('purple')
  })

  it('rejects a kart template whose structure is incomplete', () => {
    const template = kartTemplate()
    template.remove(template.getObjectByName('wheelBackLeft')!)
    expect(() => createKartFromTemplate(template, 'red', palette(), 'rival'))
      .toThrow('Kart template missing named part: wheelBackLeft')
  })

  it('keeps the cached template usable after one clone is disposed', () => {
    const template = kartTemplate()
    const templateBodyMesh = template.getObjectByName('body')!.children[0] as THREE.Mesh
    const geoDispose = vi.spyOn(templateBodyMesh.geometry, 'dispose')
    const matDispose = vi.spyOn(Array.isArray(templateBodyMesh.material) ? templateBodyMesh.material[1] : templateBodyMesh.material, 'dispose')
    const firstClone = createKartFromTemplate(template, 'teal', palette(), 'garage')

    disposeObject3D(firstClone)
    const secondClone = createKartFromTemplate(template, 'purple', palette(), 'player')

    expect(geoDispose).not.toHaveBeenCalled()
    expect(matDispose).not.toHaveBeenCalled()
    expect(findMaterial(secondClone, 'red').color.getStyle()).toBe(new THREE.Color('purple').getStyle())
    expect(findMaterial(template, 'red').color.getStyle()).toBe(new THREE.Color('#e85553').getStyle())
  })
})

function kartTemplate(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'raceCarRed'

  const bodyNode = new THREE.Group()
  bodyNode.name = 'body'
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 3),
    [
      new THREE.MeshStandardMaterial({ name: 'carTire', color: '#444444', roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ name: 'red', color: '#e85553', roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ name: 'glass', color: '#4c6077', roughness: 0.15 }),
    ],
  )
  bodyMesh.name = 'Mesh body'
  bodyNode.add(bodyMesh)
  root.add(bodyNode)

  for (const wheelName of ['wheelBackLeft', 'wheelBackRight', 'wheelFrontLeft', 'wheelFrontRight']) {
    const wheelNode = new THREE.Group()
    wheelNode.name = wheelName
    const wheelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16),
      [
        new THREE.MeshStandardMaterial({ name: 'carTire', color: '#444444', roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ name: 'grey', color: '#f1f2f6', roughness: 0.4 }),
      ],
    )
    wheelMesh.name = 'Mesh ' + wheelName
    wheelNode.add(wheelMesh)
    root.add(wheelNode)
  }

  return root
}

function findMaterial(root: THREE.Object3D, materialName: string): THREE.MeshStandardMaterial {
  let found: THREE.MeshStandardMaterial | null = null
  root.traverse((object) => {
    if (found || !(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const mat of materials) {
      if (mat.name === materialName) { found = mat as THREE.MeshStandardMaterial; return }
    }
  })
  if (!found) throw new Error(`Material not found: ${materialName}`)
  return found
}

function castingMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const matches: THREE.Mesh[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.castShadow) matches.push(object)
  })
  return matches
}

function palette(): GrandPrixPalette {
  return {
    sky: 'skyblue', grass: 'green', grassShadow: 'darkgreen', asphalt: 'gray',
    kerbRed: 'red', kerbWhite: 'white', barrierTeal: 'teal', barrierYellow: 'yellow',
    kart: { red: 'red', yellow: 'yellow', teal: 'teal', purple: 'purple' },
    kartStripe: 'white', tyre: 'black', gantry: 'black', gantryPost: 'teal',
    shadow: 'black', treeTrunk: 'brown', treeCanopy: 'green', sun: 'white',
    ambient: 'white', concrete: 'gray', hdbCream: 'beige', hdbCoral: 'coral',
    hdbMint: 'aquamarine', shophouseMustard: 'goldenrod', shophouseAqua: 'aqua',
    shophouseCoral: 'coral', hawkerRed: 'red', hawkerTeal: 'teal', rail: 'silver',
    window: 'navy', roadMarking: 'white',
  } as GrandPrixPalette
}
