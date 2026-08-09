import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createDistrictWorld } from '@/components/spelling-race/world/districts'
import { createSingaporeHeartlandDistrict } from '@/components/spelling-race/world/districts/singaporeHeartland'
import type { GrandPrixPalette } from '@/components/spelling-race/kartModel'
import { createAssetCatalogue, type AssetBackend, type LoadedWorldAssets } from './assets'
import { routeTransform } from './placement'
import { FIXTURE_HARBOUR_ROUTE, SINGAPORE_HEARTLAND_ROUTE, createRouteCurve } from './routes'
import type { AssetId, LandmarkPlacement, RouteCard } from './types'

describe('district world registry', () => {
  it('creates the fixture district from its acquired renderer-complete bundle without leaking shared models', async () => {
    const catalogue = createAssetCatalogue(assetBackend())
    const loaded = await catalogue.acquire(FIXTURE_HARBOUR_ROUTE)

    expect([...loaded.models.keys()]).toEqual(['kart', 'gantry', 'fixture-block'])

    const world = createDistrictWorld(FIXTURE_HARBOUR_ROUTE, loaded, palette())
    expect(landmarkRoots(world.root).map((root) => root.userData.assetId)).toEqual(['fixture-block'])

    world.dispose()
    catalogue.release(FIXTURE_HARBOUR_ROUTE.id)
  })

  it('dispatches each route card to its district without leaking fixture scenery', () => {
    const singapore = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())
    const fixtureAssets = assets(FIXTURE_HARBOUR_ROUTE)
    fixtureAssets.models.set('hdb-slab', template('hdb-slab'))
    const fixture = createDistrictWorld(FIXTURE_HARBOUR_ROUTE, fixtureAssets, palette())

    expect(singapore.root.name).toBe('district-singapore-heartland')
    expect(fixture.root.name).toBe('district-fixture')
    expect(landmarkRoots(fixture.root).map((root) => root.userData.assetId)).toEqual(['fixture-block'])
  })

  it('caps GLB building fillers and hides them at low quality', () => {
    const buildingModel = template('hdb-slab')
    const world = createSingaporeHeartlandDistrict(
      SINGAPORE_HEARTLAND_ROUTE,
      assets(SINGAPORE_HEARTLAND_ROUTE),
      palette(),
      [buildingModel],
    )
    const fillers = world.root.children.flatMap((zone) => zone.children)
      .filter((node) => node.name.startsWith('filler-'))

    expect(fillers.length).toBeGreaterThan(0)
    expect(fillers.length).toBeLessThanOrEqual(500)
    world.setQuality('safe')
    expect(fillers.every((filler) => !filler.visible)).toBe(true)
  })

  it('creates exactly the route-card landmarks and applies their route-relative transforms', () => {
    const placement: LandmarkPlacement = {
      ...SINGAPORE_HEARTLAND_ROUTE.landmarks[0],
      id: 'moved-hdb',
      progress: 0.43,
      lateral: -16,
      elevation: 1.5,
      yaw: 0.37,
      scale: 0.72,
    }
    const card: RouteCard = {
      ...SINGAPORE_HEARTLAND_ROUTE,
      requiredAssets: ['hdb-slab'],
      optionalAssets: [],
      landmarks: [placement],
    }
    const world = createDistrictWorld(card, assets(card), palette())
    const roots = landmarkRoots(world.root)
    const expected = routeTransform(createRouteCurve(card), placement)

    expect(roots.map((root) => root.userData.landmarkId)).toEqual(['moved-hdb'])
    expect(roots[0].matrix.toArray()).toEqual(closeMatrix(expected))
  })

  it('faces broad roadside facades inward instead of extending them across the chase corridor', () => {
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)

    // hdb-east-slab uses real GLB models — check the overall building orientation
    const hdbPlacement = SINGAPORE_HEARTLAND_ROUTE.landmarks.find((l) => l.id === 'hdb-east-slab')!
    const hdbTangent = curve.getTangentAt(hdbPlacement.progress).normalize()
    const hdbRight = new THREE.Vector3(hdbTangent.z, 0, -hdbTangent.x).normalize()
    const hdbLandmark = landmarkRoots(world.root).find((c) => c.userData.landmarkId === 'hdb-east-slab')!
    // The model is the first child of the landmark root
    const hdbModel = hdbLandmark.children[0] as THREE.Group
    const buildingFront = new THREE.Vector3(0, 0, -1)
    hdbModel.updateWorldMatrix(true, false)
    buildingFront.transformDirection(hdbModel.matrixWorld)
    // After flip: detailed/striped face (+Z) now faces track; model front (-Z) faces away
    expect(buildingFront.dot(hdbRight) * Math.sign(hdbPlacement.lateral)).toBeGreaterThan(0.98)
    expect(Math.abs(buildingFront.dot(hdbTangent))).toBeLessThan(0.2)

    // shophouse-row-west still uses original model with named parts
    const shophousePlacement = SINGAPORE_HEARTLAND_ROUTE.landmarks.find((l) => l.id === 'shophouse-row-west')!
    const shopTangent = curve.getTangentAt(shophousePlacement.progress).normalize()
    const shopRight = new THREE.Vector3(shopTangent.z, 0, -shopTangent.x).normalize()
    const shopFacadeFront = new THREE.Vector3(0, 0, -1)
    const shopLandmark = landmarkRoots(world.root).find((c) => c.userData.landmarkId === 'shophouse-row-west')!
    const shopPart = shopLandmark.getObjectByName('five_varied_bays')!
    shopPart.updateWorldMatrix(true, false)
    shopFacadeFront.transformDirection(shopPart.matrixWorld)

    expect(shopFacadeFront.dot(shopRight) * Math.sign(shophousePlacement.lateral)).toBeGreaterThan(0.98)
    expect(Math.abs(shopFacadeFront.dot(shopTangent))).toBeLessThan(0.2)
  })

  it('hangs one red-white flag pair over every shophouse bay', () => {
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())
    const shophouses = landmarkRoots(world.root).filter((root) => root.userData.assetId === 'shophouse-row')
    const near = shophouses.find((landmark) => landmark.userData.detailTier === 'near')!
    const middle = shophouses.find((landmark) => landmark.userData.detailTier === 'middle')!

    expect((near.getObjectByName('flag-red-stripes') as THREE.InstancedMesh).count).toBe(5)
    expect((near.getObjectByName('flag-white-stripes') as THREE.InstancedMesh).count).toBe(5)
    expect(middle.getObjectByName('original-red-white-flags')).toBeUndefined()
  })

  it('tags every Singapore landmark root with its authored detail tier', () => {
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())

    expect(landmarkRoots(world.root).map((root) => [root.userData.landmarkId, root.userData.detailTier])).toEqual([
      ['hdb-east-slab', 'near'],
      ['hdb-grid-1', 'near'],
      ['hdb-east-point', 'near'],
      ['hdb-grid-2', 'middle'],
      ['hdb-east-lamp', 'near'],
      ['hdb-grid-3', 'near'],
      ['hdb-central-slab', 'near'],
      ['hdb-grid-4', 'middle'],
      ['hdb-central-point', 'middle'],
      ['hdb-grid-5', 'near'],
      ['hdb-west-slab', 'middle'],
      ['hdb-grid-6', 'middle'],
      ['hdb-hawker-1', 'middle'],
      ['hdb-hawker-2', 'near'],
      ['supertree-1', 'near'],
      ['supertree-2', 'middle'],
      ['supertree-3', 'near'],
      ['supertree-4', 'middle'],
      ['supertree-5', 'near'],
      ['hdb-hawker-3', 'middle'],
      ['hdb-hawker-4', 'middle'],
      ['hawker-centre', 'near'],
      ['hawker-rain-tree', 'near'],
      ['hawker-table-east', 'middle'],
      ['hawker-table-west', 'middle'],
      ['hdb-hawker-5', 'near'],
      ['hdb-hawker-6', 'middle'],
      ['hdb-hawker-7', 'distant'],
      ['mbs-skyline', 'distant'],
      ['hdb-hawker-8', 'near'],
      ['hdb-hawker-9', 'middle'],
      ['flyer-skyline', 'distant'],
      ['hdb-hawker-10', 'middle'],
      ['hdb-hawker-11', 'near'],
      ['rail-span-start', 'near'],
      ['hdb-rail-1', 'middle'],
      ['hdb-rail-2', 'near'],
      ['rail-station', 'middle'],
      ['shophouse-row-east', 'near'],
      ['rail-span-middle', 'near'],
      ['hdb-rail-3', 'middle'],
      ['hdb-rail-4', 'near'],
      ['shophouse-row-west', 'middle'],
      ['rail-span-end', 'near'],
      ['hdb-rail-5', 'middle'],
      ['skyline-slab-east', 'distant'],
      ['hdb-rail-6', 'distant'],
      ['skyline-slab-west', 'distant'],
      ['hdb-rail-7', 'distant'],
      ['hdb-rail-8', 'distant'],
      ['hdb-rail-9', 'distant'],
      ['hdb-rail-10', 'distant'],
    ])
  })

  it('degrades landmark visibility monotonically while retaining required Singapore cues at Safe', () => {
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())

    world.setQuality('high')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-grid-1', 'hdb-east-point', 'hdb-grid-2', 'hdb-east-lamp',
      'hdb-grid-3', 'hdb-central-slab', 'hdb-grid-4', 'hdb-central-point', 'hdb-grid-5',
      'hdb-west-slab', 'hdb-grid-6', 'hdb-hawker-1', 'hdb-hawker-2', 'supertree-1',
      'supertree-2', 'supertree-3', 'supertree-4', 'supertree-5', 'hdb-hawker-3',
      'hdb-hawker-4', 'hawker-centre', 'hawker-rain-tree', 'hawker-table-east', 'hawker-table-west',
      'hdb-hawker-5', 'hdb-hawker-6', 'hdb-hawker-7', 'mbs-skyline', 'hdb-hawker-8',
      'hdb-hawker-9', 'flyer-skyline', 'hdb-hawker-10', 'hdb-hawker-11', 'rail-span-start',
      'hdb-rail-1', 'hdb-rail-2', 'rail-station', 'shophouse-row-east', 'rail-span-middle',
      'hdb-rail-3', 'hdb-rail-4', 'shophouse-row-west', 'rail-span-end', 'hdb-rail-5',
      'skyline-slab-east', 'hdb-rail-6', 'skyline-slab-west', 'hdb-rail-7', 'hdb-rail-8',
      'hdb-rail-9', 'hdb-rail-10',
    ])

    world.setQuality('balanced')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-grid-1', 'hdb-east-point', 'hdb-grid-2', 'hdb-east-lamp',
      'hdb-grid-3', 'hdb-central-slab', 'hdb-grid-4', 'hdb-central-point', 'hdb-grid-5',
      'hdb-west-slab', 'hdb-grid-6', 'hdb-hawker-1', 'hdb-hawker-2', 'supertree-1',
      'supertree-2', 'supertree-3', 'supertree-4', 'supertree-5', 'hdb-hawker-3',
      'hdb-hawker-4', 'hawker-centre', 'hawker-rain-tree', 'hawker-table-east', 'hawker-table-west',
      'hdb-hawker-5', 'hdb-hawker-6', 'hdb-hawker-8', 'hdb-hawker-9', 'hdb-hawker-10',
      'hdb-hawker-11', 'rail-span-start', 'hdb-rail-1', 'hdb-rail-2', 'rail-station',
      'shophouse-row-east', 'rail-span-middle', 'hdb-rail-3', 'hdb-rail-4', 'shophouse-row-west',
      'rail-span-end', 'hdb-rail-5',
    ])

    world.setQuality('safe')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-grid-1', 'hdb-east-point', 'hdb-east-lamp', 'hdb-grid-3',
      'hdb-central-slab', 'hdb-grid-5', 'hdb-west-slab', 'hdb-hawker-2', 'supertree-1',
      'supertree-3', 'supertree-5', 'hawker-centre', 'hawker-rain-tree', 'hdb-hawker-5',
      'hdb-hawker-8', 'hdb-hawker-11', 'rail-span-start', 'hdb-rail-2', 'shophouse-row-east',
      'rail-span-middle', 'hdb-rail-4', 'shophouse-row-west', 'rail-span-end',
    ])
  })

  it('omits a missing optional landmark but rejects a missing required landmark', () => {
    const optionalMissing = assets(SINGAPORE_HEARTLAND_ROUTE)
    optionalMissing.models.delete('street-lamp')
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, optionalMissing, palette())

    expect(landmarkRoots(world.root).map((root) => root.userData.landmarkId)).not.toContain('hdb-east-lamp')

    const requiredMissing = assets(SINGAPORE_HEARTLAND_ROUTE)
    requiredMissing.models.delete('rail-span')
    expect(() => createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, requiredMissing, palette()))
      .toThrow('Loaded world model missing: rail-span')
  })

  it('disposes district-owned materials once and detaches its root', () => {
    const world = createDistrictWorld(FIXTURE_HARBOUR_ROUTE, assets(FIXTURE_HARBOUR_ROUTE), palette())
    const parent = new THREE.Group().add(world.root)
    const mesh = world.root.getObjectByName('fixture_block') as THREE.Mesh
    const material = mesh.material as THREE.Material
    const dispose = vi.spyOn(material, 'dispose')

    world.dispose()
    world.dispose()

    expect(dispose).toHaveBeenCalledTimes(1)
    expect(parent.children).toEqual([])
    expect(world.root.children).toEqual([])
  })
})

function landmarkRoots(root: THREE.Object3D): THREE.Group[] {
  const landmarks: THREE.Group[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Group && object.userData.landmarkId) landmarks.push(object)
  })
  return landmarks
}

function visibleLandmarks(root: THREE.Object3D): string[] {
  return landmarkRoots(root).filter((landmark) => landmark.visible).map((landmark) => landmark.userData.landmarkId as string)
}

function closeMatrix(matrix: THREE.Matrix4): number[] {
  return matrix.toArray().map((value) => expect.closeTo(value, 10) as unknown as number)
}

function assets(card: RouteCard): LoadedWorldAssets & { models: Map<AssetId, THREE.Group> } {
  const models = new Map<AssetId, THREE.Group>()
  for (const assetId of [...card.requiredAssets, ...card.optionalAssets]) models.set(assetId, template(assetId))
  return { routeId: card.id, models, textures: new Map(), missingOptional: [] }
}

function template(assetId: AssetId): THREE.Group {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 'gray' }))
  mesh.name = assetId === 'fixture-block' ? 'fixture_block' : partName(assetId)
  group.add(mesh)
  return group
}

function assetBackend(): AssetBackend {
  return {
    loadModel: async (path) => template(path.split('/').at(-1)!.replace('.glb', '') as AssetId),
    loadTexture: async () => new THREE.Texture(),
    disposeModel: () => {},
    disposeTexture: () => {},
  }
}

function partName(assetId: AssetId): string {
  if (assetId === 'hdb-slab') return 'bevelled_slab'
  if (assetId === 'hdb-point') return 'compact_tower'
  if (assetId === 'shophouse-row') return 'five_varied_bays'
  if (assetId === 'hawker-centre') return 'open_frontage'
  if (assetId === 'rail-span') return 'rounded_beam'
  if (assetId === 'rail-station') return 'unbranded_canopy'
  if (assetId === 'rain-tree') return 'canopy_lobes'
  if (assetId === 'street-lamp') return 'tapered_post'
  if (assetId === 'hawker-table') return 'round_table'
  return assetId
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
  }
}
