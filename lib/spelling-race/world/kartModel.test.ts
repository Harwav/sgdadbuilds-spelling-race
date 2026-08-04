import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { applyKartPaint, createKartFromTemplate, disposeObject3D, type GrandPrixPalette } from '@/components/spelling-race/kartModel'

describe('shared kart model', () => {
  it('clones and recolours only the GLB paint parts while keeping one restrained contact shadow', () => {
    const template = kartTemplate()
    const originalBody = material(template, 'paint_body')
    const originalTyres = material(template, 'tyres')
    const originalVisor = material(template, 'visor')
    const kart = createKartFromTemplate(template, 'teal', palette(), 'player')

    expect(kart).not.toBe(template)
    expect(material(kart, 'paint_body')).not.toBe(originalBody)
    expect(material(kart, 'paint_body').color.getStyle()).toBe(new THREE.Color('teal').getStyle())
    expect(material(kart, 'paint_stripe').color.getStyle()).toBe(new THREE.Color('white').getStyle())
    expect(material(kart, 'rims').color.getStyle()).toBe(new THREE.Color('teal').getStyle())
    expect(material(kart, 'tyres').color.getStyle()).toBe(originalTyres.color.getStyle())
    expect(material(kart, 'tyres').roughness).toBe(originalTyres.roughness)
    expect(material(kart, 'visor').color.getStyle()).toBe(originalVisor.color.getStyle())
    expect(material(kart, 'visor').roughness).toBe(originalVisor.roughness)
    expect(material(template, 'paint_body')).toBe(originalBody)
    expect(originalBody.color.getStyle()).toBe(new THREE.Color('red').getStyle())
    kart.updateMatrixWorld(true)
    const orientedBody = new THREE.Box3().setFromObject(kart.getObjectByName('paint_body')!)
    expect(orientedBody.getCenter(new THREE.Vector3()).z).toBeGreaterThan(0)

    const shadows = namedMeshes(kart, 'contact_shadow')
    expect(shadows).toHaveLength(1)
    expect((shadows[0].material as THREE.MeshStandardMaterial).opacity).toBeLessThanOrEqual(0.3)
    expect((shadows[0].material as THREE.MeshStandardMaterial).depthWrite).toBe(false)
    expect(castingMeshes(kart).map((mesh) => mesh.name)).toEqual(['paint_body'])
  })

  it('repaints the existing clone without replacing its material or altering tyres and visor', () => {
    const paletteValue = palette()
    const kart = createKartFromTemplate(kartTemplate(), 'red', paletteValue, 'garage')
    const body = material(kart, 'paint_body')
    const tyresBefore = material(kart, 'tyres').color.getStyle()
    const visorBefore = material(kart, 'visor').color.getStyle()

    applyKartPaint(kart, 'purple', paletteValue)

    expect(material(kart, 'paint_body')).toBe(body)
    expect(body.color.getStyle()).toBe(new THREE.Color('purple').getStyle())
    expect(material(kart, 'tyres').color.getStyle()).toBe(tyresBefore)
    expect(material(kart, 'visor').color.getStyle()).toBe(visorBefore)
    expect(kart.userData.kartColour).toBe('purple')
  })

  it('rejects a kart template whose named paint contract is incomplete', () => {
    const template = kartTemplate()
    template.remove(template.getObjectByName('rims')!)

    expect(() => createKartFromTemplate(template, 'red', palette(), 'rival'))
      .toThrow('Kart template missing named part: rims')
  })

  it('keeps the cached template usable after one clone is disposed', () => {
    const template = kartTemplate()
    const templateBody = namedMeshes(template, 'paint_body')[0]
    const templateGeometryDispose = vi.spyOn(templateBody.geometry, 'dispose')
    const templateMaterialDispose = vi.spyOn(material(template, 'paint_body'), 'dispose')
    const firstClone = createKartFromTemplate(template, 'teal', palette(), 'garage')

    disposeObject3D(firstClone)
    const secondClone = createKartFromTemplate(template, 'purple', palette(), 'player')

    expect(templateGeometryDispose).not.toHaveBeenCalled()
    expect(templateMaterialDispose).not.toHaveBeenCalled()
    expect(material(secondClone, 'paint_body').color.getStyle()).toBe(new THREE.Color('purple').getStyle())
    expect(material(template, 'paint_body').color.getStyle()).toBe(new THREE.Color('red').getStyle())
  })
})

function kartTemplate(): THREE.Group {
  const root = new THREE.Group()
  const body = mesh('paint_body', 'red', 0.42)
  body.geometry.translate(0, 0, -3)
  root.add(
    body,
    mesh('paint_stripe', 'yellow', 0.4),
    mesh('tyres', 'black', 0.88),
    mesh('rims', 'silver', 0.32),
    mesh('visor', 'navy', 0.18),
    mesh('contact_shadow', 'black', 1, 0.42),
  )
  return root
}

function mesh(name: string, colour: string, roughness: number, opacity = 1): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness, transparent: opacity < 1, opacity })
  const result = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
  result.name = name
  return result
}

function namedMeshes(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const matches: THREE.Mesh[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name === name) matches.push(object)
  })
  return matches
}

function castingMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const matches: THREE.Mesh[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.castShadow) matches.push(object)
  })
  return matches
}

function material(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial {
  const matches = namedMeshes(root, name)
  if (matches.length !== 1 || Array.isArray(matches[0].material)) throw new Error(`Expected one material for ${name}`)
  return matches[0].material as THREE.MeshStandardMaterial
}

function palette(): GrandPrixPalette {
  return {
    sky: 'skyblue',
    grass: 'green',
    grassShadow: 'darkgreen',
    asphalt: 'gray',
    kerbRed: 'red',
    kerbWhite: 'white',
    barrierTeal: 'teal',
    barrierYellow: 'yellow',
    kart: { red: 'red', yellow: 'yellow', teal: 'teal', purple: 'purple' },
    kartStripe: 'white',
    tyre: 'black',
    gantry: 'black',
    gantryPost: 'teal',
    shadow: 'black',
    treeTrunk: 'brown',
    treeCanopy: 'green',
    sun: 'white',
    ambient: 'white',
    concrete: 'gray',
    hdbCream: 'beige',
    hdbCoral: 'coral',
    hdbMint: 'aquamarine',
    shophouseMustard: 'goldenrod',
    shophouseAqua: 'aqua',
    shophouseCoral: 'coral',
    hawkerRed: 'red',
    hawkerTeal: 'teal',
    rail: 'silver',
    window: 'navy',
    roadMarking: 'white',
  } as GrandPrixPalette
}
