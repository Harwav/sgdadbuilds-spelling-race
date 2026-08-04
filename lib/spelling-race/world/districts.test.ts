import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createDistrictWorld } from '@/components/spelling-race/world/districts'
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

    for (const [landmarkId, partName] of [
      ['hdb-east-slab', 'bevelled_slab'],
      ['shophouse-row-west', 'five_varied_bays'],
    ] as const) {
      const placement = SINGAPORE_HEARTLAND_ROUTE.landmarks.find((landmark) => landmark.id === landmarkId)!
      const tangent = curve.getTangentAt(placement.progress).normalize()
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
      const facadeFront = new THREE.Vector3(0, 0, -1)
      const landmark = landmarkRoots(world.root).find((candidate) => candidate.userData.landmarkId === landmarkId)!
      const part = landmark.getObjectByName(partName)!
      part.updateWorldMatrix(true, false)
      facadeFront.transformDirection(part.matrixWorld)

      expect(facadeFront.dot(right) * Math.sign(placement.lateral)).toBeLessThan(-0.98)
      expect(Math.abs(facadeFront.dot(tangent))).toBeLessThan(0.2)
    }
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
      ['hdb-east-point', 'near'],
      ['hdb-east-lamp', 'near'],
      ['hdb-central-slab', 'near'],
      ['hdb-central-point', 'middle'],
      ['hdb-west-slab', 'middle'],
      ['hawker-centre', 'near'],
      ['hawker-rain-tree', 'near'],
      ['hawker-table-east', 'middle'],
      ['hawker-table-west', 'middle'],
      ['rail-span-start', 'near'],
      ['rail-station', 'middle'],
      ['shophouse-row-east', 'near'],
      ['rail-span-middle', 'near'],
      ['shophouse-row-west', 'middle'],
      ['rail-span-end', 'near'],
      ['skyline-slab-east', 'distant'],
      ['skyline-slab-west', 'distant'],
    ])
  })

  it('degrades landmark visibility monotonically while retaining required Singapore cues at Safe', () => {
    const world = createDistrictWorld(SINGAPORE_HEARTLAND_ROUTE, assets(SINGAPORE_HEARTLAND_ROUTE), palette())

    world.setQuality('high')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-east-point', 'hdb-east-lamp', 'hdb-central-slab', 'hdb-central-point',
      'hdb-west-slab', 'hawker-centre', 'hawker-rain-tree', 'hawker-table-east', 'hawker-table-west',
      'rail-span-start', 'rail-station', 'shophouse-row-east', 'rail-span-middle', 'shophouse-row-west',
      'rail-span-end', 'skyline-slab-east', 'skyline-slab-west',
    ])

    world.setQuality('balanced')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-east-point', 'hdb-east-lamp', 'hdb-central-slab', 'hdb-central-point',
      'hdb-west-slab', 'hawker-centre', 'hawker-rain-tree', 'hawker-table-east', 'hawker-table-west',
      'rail-span-start', 'rail-station', 'shophouse-row-east', 'rail-span-middle', 'shophouse-row-west',
      'rail-span-end',
    ])

    world.setQuality('safe')
    expect(visibleLandmarks(world.root)).toEqual([
      'hdb-east-slab', 'hdb-east-point', 'hdb-east-lamp', 'hdb-central-slab', 'hdb-west-slab',
      'hawker-centre', 'hawker-rain-tree', 'rail-span-start', 'shophouse-row-east', 'rail-span-middle',
      'shophouse-row-west', 'rail-span-end',
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
