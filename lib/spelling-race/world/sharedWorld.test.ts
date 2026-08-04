import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createWorldMaterials } from '@/components/spelling-race/world/materials'
import {
  createSharedWorld,
  createWorldDisposalScope,
  runWorldInitialization,
} from '@/components/spelling-race/world/sharedWorld'
import { createTrackWorld, sampleTrack, type TrackSample } from '@/components/spelling-race/world/track'
import type { GrandPrixPalette } from '@/components/spelling-race/kartModel'
import { TRACK_LENGTH } from '@/lib/spelling-race/raceSimulation'
import { countVisibleShadowCasters } from '@/components/spelling-race/world/visualDiagnostics'
import type { LoadedWorldAssets } from './assets'
import { SINGAPORE_HEARTLAND_ROUTE } from './routes'

describe('shared Grand Prix world', () => {
  it('maps simulation progress and lateral position onto the route-card track contract', () => {
    const materials = createWorldMaterials(palette(), assets())
    const track = createTrackWorld(SINGAPORE_HEARTLAND_ROUTE, materials)
    const atQuarter = sample()
    const wrappedQuarter = sample()
    const clampedRight = sample()

    sampleTrack(track, TRACK_LENGTH * 0.25, 0, atQuarter)
    sampleTrack(track, TRACK_LENGTH * 1.25, 0, wrappedQuarter)
    sampleTrack(track, TRACK_LENGTH * 0.25, 2, clampedRight)

    expect(track.halfWidth).toBe(5.6)
    expect(wrappedQuarter.point.distanceTo(atQuarter.point)).toBeLessThan(0.000_001)
    expect(clampedRight.point.distanceTo(atQuarter.point)).toBeCloseTo(4.4, 5)
    expect(clampedRight.right.length()).toBeCloseTo(1, 6)
  })

  it('uses the three repeated asphalt maps on the one road material and token geometry for markings', () => {
    const loaded = assets()
    const materials = createWorldMaterials(palette(), loaded)
    const track = createTrackWorld(SINGAPORE_HEARTLAND_ROUTE, materials)
    const road = track.root.getObjectByName('track-asphalt') as THREE.Mesh
    const markings = track.root.getObjectByName('track-start-grid') as THREE.Group
    const uv = road.geometry.getAttribute('uv') as THREE.BufferAttribute

    expect(materials.asphalt.map).toBe(loaded.textures.get('asphalt-diffuse'))
    expect(materials.asphalt.normalMap).toBe(loaded.textures.get('asphalt-normal'))
    expect(materials.asphalt.roughnessMap).toBe(loaded.textures.get('asphalt-roughness'))
    expect(materials.asphalt.map?.wrapS).toBe(THREE.RepeatWrapping)
    expect(materials.asphalt.map?.wrapT).toBe(THREE.RepeatWrapping)
    expect(Math.max(...Array.from(uv.array))).toBe(10)
    expect(road.material).toBe(materials.asphalt)
    expect((markings.children[0] as THREE.Mesh).material).toBe(materials.roadMarking)
    const barrier = track.root.getObjectByName('track-barrier-teal') as THREE.InstancedMesh
    expect((barrier.geometry.getAttribute('position') as THREE.BufferAttribute).count).toBeGreaterThan(24)
    barrier.geometry.computeBoundingBox()
    const barrierSize = barrier.geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(barrierSize.x).toBeLessThanOrEqual(3)
    expect(barrierSize.y).toBeLessThanOrEqual(0.65)
    expect(barrierSize.z).toBeLessThanOrEqual(0.8)
  })

  it('keeps the high-quality motion counts and shared lighting contract', () => {
    const world = createSharedWorld({
      card: SINGAPORE_HEARTLAND_ROUTE,
      assets: assets(),
      palette: palette(),
    })

    expect(world.speedStreaks.positions).toHaveLength(18 * 2 * 3)
    expect(world.boostParticles.mesh.count).toBe(12)
    expect(world.sun.castShadow).toBe(true)
    expect(world.sun.shadow.mapSize.width).toBe(1024)
    expect(world.fog.near).toBe(34)
    expect(world.fog.far).toBe(112)
    expect(countVisibleShadowCasters(world.root)).toBeLessThanOrEqual(3)
  })

  it('disposes partial scene state and releases its asset lease once after post-acquire initialization fails', () => {
    const releaseLease = vi.fn()
    const disposeRenderer = vi.fn()
    const disposePartialScene = vi.fn(() => { throw new Error('scene disposal failed') })
    const showFallback = vi.fn()
    const scope = createWorldDisposalScope()
    scope.defer(releaseLease)

    const initialized = runWorldInitialization(scope, () => {
      scope.defer(disposeRenderer)
      scope.defer(disposePartialScene)
      throw new Error('post-acquire initialization failed')
    }, showFallback)
    scope.dispose()

    expect(initialized).toBe(false)
    expect(disposeRenderer).toHaveBeenCalledTimes(1)
    expect(disposePartialScene).toHaveBeenCalledTimes(1)
    expect(releaseLease).toHaveBeenCalledTimes(1)
    expect(showFallback).toHaveBeenCalledTimes(1)
  })
})

function sample(): TrackSample {
  return {
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
  }
}

function assets(): LoadedWorldAssets {
  return {
    routeId: 'singapore-heartland',
    models: new Map(),
    textures: new Map([
      ['asphalt-diffuse', new THREE.Texture()],
      ['asphalt-normal', new THREE.Texture()],
      ['asphalt-roughness', new THREE.Texture()],
    ]),
    missingOptional: [],
  }
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
