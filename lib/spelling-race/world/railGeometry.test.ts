import path from 'node:path'
import { NodeIO, type Node } from '@gltf-transform/core'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { GrandPrixPalette } from '@/components/spelling-race/kartModel'
import { createWorldMaterials } from '@/components/spelling-race/world/materials'
import { createTrackWorld } from '@/components/spelling-race/world/track'
import type { LoadedWorldAssets } from './assets'
import { routeTransform } from './placement'
import { SINGAPORE_HEARTLAND_ROUTE, createRouteCurve } from './routes'

const MINIMUM_ASPHALT_CLEARANCE = 1.25
const MINIMUM_BARRIER_CLEARANCE = 0.5

type Point2 = { x: number; z: number }

describe('Singapore rail-span production geometry', () => {
  it('keeps a distinct toy carriage above the continuous guideway with a roof and repeated dark detail band', async () => {
    const document = await new NodeIO().read(path.join(
      process.cwd(),
      'public/spelling-race/assets/models/rail-span.glb',
    ))
    const guideway = meshBounds(document.getRoot().listNodes().find((node) => node.getName() === 'rounded_beam'))
    const carriage = meshBounds(document.getRoot().listNodes().find((node) => node.getName() === 'carriage_body'))
    const roofAndParapets = meshBounds(document.getRoot().listNodes().find((node) => node.getName() === 'parapets'))
    const railAndCarriageDetails = meshBounds(document.getRoot().listNodes().find((node) => node.getName() === 'two_rails'))

    expect(carriage.maximumX - carriage.minimumX).toBeGreaterThanOrEqual(19)
    expect(carriage.maximumY - carriage.minimumY).toBeGreaterThanOrEqual(1.4)
    expect(carriage.minimumY).toBeGreaterThan(guideway.maximumY + 1)
    expect(roofAndParapets.maximumY).toBeGreaterThan(carriage.maximumY)
    expect(railAndCarriageDetails.maximumY).toBeGreaterThan(carriage.minimumY + 0.8)
  })

  it('grounds every authored rail-span pier on the route plane', async () => {
    const pierVertices = await loadPierVertices()
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const spans = SINGAPORE_HEARTLAND_ROUTE.landmarks.filter((landmark) => landmark.assetId === 'rail-span')

    for (const span of spans) {
      const matrix = routeTransform(curve, span)
      const worldVertices = pierVertices.map((vertex) => vertex.clone().applyMatrix4(matrix))
      const minimumY = Math.min(...worldVertices.map((vertex) => vertex.y))

      expect(minimumY, `${span.id} pier ground contact`).toBeCloseTo(0, 5)
    }
  })

  it('keeps every pier at least 1.25 world units from the rendered asphalt ribbon', async () => {
    const pierVertices = await loadPierVertices()
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const { roadTriangles } = productionTrackGeometry()
    const spans = SINGAPORE_HEARTLAND_ROUTE.landmarks.filter((landmark) => landmark.assetId === 'rail-span')

    for (const span of spans) {
      const matrix = routeTransform(curve, span)
      const worldVertices = pierVertices.map((vertex) => vertex.clone().applyMatrix4(matrix))
      const sidePolygons = [-1, 1].map((side) => convexHull(
        worldVertices
          .filter((_, index) => Math.sign(pierVertices[index].x) === side)
          .map(({ x, z }) => ({ x, z })),
      ))
      const clearance = Math.min(...sidePolygons.map((polygon) => clearanceFromRoad(polygon, roadTriangles)))

      expect(clearance, `${span.id} asphalt clearance`).toBeGreaterThanOrEqual(MINIMUM_ASPHALT_CLEARANCE)
    }
  })

  it('keeps every pier at least 0.5 world units from the rendered roadside barriers', async () => {
    const pierVertices = await loadPierVertices()
    const curve = createRouteCurve(SINGAPORE_HEARTLAND_ROUTE)
    const { barrierPolygons } = productionTrackGeometry()
    const spans = SINGAPORE_HEARTLAND_ROUTE.landmarks.filter((landmark) => landmark.assetId === 'rail-span')

    for (const span of spans) {
      const matrix = routeTransform(curve, span)
      for (const side of [-1, 1]) {
        const polygon = convexHull(
          pierVertices
            .filter((_, index) => Math.sign(pierVertices[index].x) === side)
            .map((vertex) => {
              const { x, z } = vertex.clone().applyMatrix4(matrix)
              return { x, z }
            }),
        )
        const clearance = Math.min(...barrierPolygons.map((barrier) => polygonDistance(polygon, barrier)))

        expect.soft(clearance, `${span.id} ${side < 0 ? 'negative' : 'positive'}-side barrier clearance`)
          .toBeGreaterThanOrEqual(MINIMUM_BARRIER_CLEARANCE)
      }
    }
  })
})

function meshBounds(node: Node | undefined): {
  minimumX: number
  maximumX: number
  minimumY: number
  maximumY: number
} {
  const positions = node?.getMesh()?.listPrimitives()[0]?.getAttribute('POSITION')?.getArray()
  if (!positions) throw new Error(`rail-span ${node?.getName() ?? 'unknown'} production geometry is missing`)

  let minimumX = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (let index = 0; index < positions.length; index += 3) {
    minimumX = Math.min(minimumX, positions[index])
    maximumX = Math.max(maximumX, positions[index])
    minimumY = Math.min(minimumY, positions[index + 1])
    maximumY = Math.max(maximumY, positions[index + 1])
  }
  return { minimumX, maximumX, minimumY, maximumY }
}

async function loadPierVertices(): Promise<THREE.Vector3[]> {
  const document = await new NodeIO().read(path.join(
    process.cwd(),
    'public/spelling-race/assets/models/rail-span.glb',
  ))
  const pierNode = document.getRoot().listNodes().find((node) => node.getName() === 'twin_piers')
  const positions = pierNode?.getMesh()?.listPrimitives()[0]?.getAttribute('POSITION')?.getArray()
  if (!positions) throw new Error('rail-span twin_piers POSITION data is missing')

  const vertices: THREE.Vector3[] = []
  for (let index = 0; index < positions.length; index += 3) {
    vertices.push(new THREE.Vector3(positions[index], positions[index + 1], positions[index + 2]))
  }
  return vertices
}

function productionTrackGeometry(): {
  roadTriangles: readonly [Point2, Point2, Point2][]
  barrierPolygons: readonly Point2[][]
} {
  const loadedAssets: LoadedWorldAssets = {
    routeId: 'singapore-heartland',
    models: new Map(),
    textures: new Map([
      ['asphalt-diffuse', new THREE.Texture()],
      ['asphalt-normal', new THREE.Texture()],
      ['asphalt-roughness', new THREE.Texture()],
    ]),
    missingOptional: [],
  }
  const materials = createWorldMaterials(palette(), loadedAssets)
  const track = createTrackWorld(SINGAPORE_HEARTLAND_ROUTE, materials)
  const road = track.root.getObjectByName('track-asphalt') as THREE.Mesh<THREE.BufferGeometry>
  const positions = road.geometry.getAttribute('position') as THREE.BufferAttribute
  const index = road.geometry.getIndex()
  if (!index) throw new Error('production asphalt geometry must be indexed')

  const triangles: Array<[Point2, Point2, Point2]> = []
  for (let offset = 0; offset < index.count; offset += 3) {
    triangles.push([
      roadPoint(positions, index.getX(offset)),
      roadPoint(positions, index.getX(offset + 1)),
      roadPoint(positions, index.getX(offset + 2)),
    ])
  }

  const barrierMaterials = new Set<THREE.Material>([materials.barrierTeal, materials.barrierYellow])
  const barrierPolygons: Point2[][] = []
  track.root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh) || !barrierMaterials.has(object.material as THREE.Material)) return
    const barrierPositions = object.geometry.getAttribute('position') as THREE.BufferAttribute
    const instanceMatrix = new THREE.Matrix4()
    for (let instance = 0; instance < object.count; instance += 1) {
      object.getMatrixAt(instance, instanceMatrix)
      const points: Point2[] = []
      for (let vertex = 0; vertex < barrierPositions.count; vertex += 1) {
        const transformed = new THREE.Vector3(
          barrierPositions.getX(vertex),
          barrierPositions.getY(vertex),
          barrierPositions.getZ(vertex),
        ).applyMatrix4(instanceMatrix)
        points.push({ x: transformed.x, z: transformed.z })
      }
      barrierPolygons.push(convexHull(points))
    }
  })
  if (barrierPolygons.length !== 96) throw new Error(`expected 96 production barriers, received ${barrierPolygons.length}`)
  return { roadTriangles: triangles, barrierPolygons }
}

function roadPoint(positions: THREE.BufferAttribute, index: number): Point2 {
  return { x: positions.getX(index), z: positions.getZ(index) }
}

function clearanceFromRoad(polygon: readonly Point2[], triangles: readonly [Point2, Point2, Point2][]): number {
  return Math.min(...triangles.map((triangle) => polygonTriangleDistance(polygon, triangle)))
}

function polygonTriangleDistance(polygon: readonly Point2[], triangle: readonly Point2[]): number {
  return polygonDistance(polygon, triangle)
}

function polygonDistance(first: readonly Point2[], second: readonly Point2[]): number {
  if (first.some((point) => pointInPolygon(point, second)) || second.some((point) => pointInPolygon(point, first))) return 0
  let minimum = Number.POSITIVE_INFINITY
  for (const firstEdge of edges(first)) {
    for (const secondEdge of edges(second)) {
      minimum = Math.min(minimum, segmentDistance(firstEdge[0], firstEdge[1], secondEdge[0], secondEdge[1]))
    }
  }
  return minimum
}

function edges(points: readonly Point2[]): Array<[Point2, Point2]> {
  return points.map((point, index) => [point, points[(index + 1) % points.length]])
}

function segmentDistance(a: Point2, b: Point2, c: Point2, d: Point2): number {
  if (segmentsIntersect(a, b, c, d)) return 0
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  )
}

function pointSegmentDistance(point: Point2, start: Point2, end: Point2): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared)
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t))
}

function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  if (oppositeSigns(abC, abD) && oppositeSigns(cdA, cdB)) return true
  return (nearlyZero(abC) && pointOnSegment(c, a, b))
    || (nearlyZero(abD) && pointOnSegment(d, a, b))
    || (nearlyZero(cdA) && pointOnSegment(a, c, d))
    || (nearlyZero(cdB) && pointOnSegment(b, c, d))
}

function oppositeSigns(first: number, second: number): boolean {
  return (first > 0 && second < 0) || (first < 0 && second > 0)
}

function nearlyZero(value: number): boolean {
  return Math.abs(value) <= Number.EPSILON * 16
}

function pointOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  return point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
    && point.z >= Math.min(start.z, end.z) && point.z <= Math.max(start.z, end.z)
}

function pointInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]
    const b = polygon[previous]
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

function convexHull(points: readonly Point2[]): Point2[] {
  const sorted = [...new Map(points.map((point) => [`${point.x},${point.z}`, point])).values()]
    .sort((a, b) => a.x - b.x || a.z - b.z)
  if (sorted.length <= 2) return sorted
  const lower: Point2[] = []
  const upper: Point2[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop()
    lower.push(point)
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function cross(origin: Point2, a: Point2, b: Point2): number {
  return (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function palette(): GrandPrixPalette {
  return {
    sky: 'skyblue', grass: 'green', grassShadow: 'darkgreen', asphalt: 'gray', kerbRed: 'red', kerbWhite: 'white',
    barrierTeal: 'teal', barrierYellow: 'yellow', kart: { red: 'red', yellow: 'yellow', teal: 'teal', purple: 'purple' },
    kartStripe: 'white', tyre: 'black', gantry: 'black', gantryPost: 'teal', shadow: 'black', treeTrunk: 'brown',
    treeCanopy: 'green', sun: 'white', ambient: 'white', concrete: 'gray', hdbCream: 'beige', hdbCoral: 'coral',
    hdbMint: 'aquamarine', shophouseMustard: 'goldenrod', shophouseAqua: 'aqua', shophouseCoral: 'coral',
    hawkerRed: 'red', hawkerTeal: 'teal', rail: 'silver', window: 'navy', roadMarking: 'white',
  }
}
