import * as THREE from 'three'
import { createRouteCurve } from './routes'
import type { RouteCard } from './types'

export type TrackEnvelopeTokens = {
  readonly asphaltHalfWidth: number
  readonly kartHalfWidth: number
  readonly kerbInnerOffset: number
  readonly kerbOuterOffset: number
  readonly runoffOuterOffset: number
  readonly barrierInnerOffset: number
  readonly sceneryClearanceOffset: number
  readonly crownHeight: number
}

export type TrackSurfaceClassification = 'asphalt' | 'kerb' | 'runoff' | 'verge' | 'barrier' | 'outside'

export type TrackSurfaceSample = {
  readonly point: THREE.Vector3
  readonly normal: THREE.Vector3
  readonly tangent: THREE.Vector3
  readonly right: THREE.Vector3
  readonly classification: TrackSurfaceClassification
  readonly legalLateralBounds: readonly [number, number]
}

export type TrackFootprint = {
  readonly progress: number
  readonly lateral: number
  readonly halfLength: number
  readonly halfWidth: number
  readonly yaw: number
}

export type TrackEnvelope = {
  readonly curve: THREE.CatmullRomCurve3
  readonly tokens: TrackEnvelopeTokens
  surfaceAt(progress: number, lateral: number): TrackSurfaceSample
  isFootprintClear(footprint: TrackFootprint): boolean
}

export function createTrackEnvelope(card: RouteCard): TrackEnvelope {
  const curve = createRouteCurve(card)
  const asphaltHalfWidth = card.circuit.halfWidth
  const tokens: TrackEnvelopeTokens = {
    asphaltHalfWidth,
    kartHalfWidth: asphaltHalfWidth - 1.2,
    kerbInnerOffset: asphaltHalfWidth + 0.08,
    kerbOuterOffset: asphaltHalfWidth + 0.8,
    runoffOuterOffset: asphaltHalfWidth + 1.6,
    barrierInnerOffset: asphaltHalfWidth + 2.25,
    sceneryClearanceOffset: asphaltHalfWidth + 3.6,
    crownHeight: 0.1,
  }

  return {
    curve,
    tokens,
    surfaceAt(progress, lateral) {
      const point = curve.getPointAt(normalizeProgress(progress))
      const tangent = curve.getTangentAt(normalizeProgress(progress)).normalize()
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
      const absoluteLateral = Math.abs(lateral)
      const crownRatio = Math.min(1, absoluteLateral / tokens.asphaltHalfWidth)
      point.addScaledVector(right, lateral)
      point.y += tokens.crownHeight * (1 - crownRatio * crownRatio)

      const slope = absoluteLateral > 0 ? -Math.sign(lateral) * (2 * tokens.crownHeight * crownRatio / tokens.asphaltHalfWidth) : 0
      const normal = new THREE.Vector3(0, 1, 0).addScaledVector(right, slope).normalize()
      return {
        point,
        normal,
        tangent,
        right,
        classification: classify(absoluteLateral, tokens),
        legalLateralBounds: [-tokens.kartHalfWidth, tokens.kartHalfWidth],
      }
    },
    isFootprintClear(footprint) {
      const effectiveHalfWidth = footprint.halfWidth * Math.abs(Math.cos(footprint.yaw))
        + footprint.halfLength * Math.abs(Math.sin(footprint.yaw))
      return Math.abs(footprint.lateral) - effectiveHalfWidth >= tokens.sceneryClearanceOffset
    },
  }
}

export function validateLandmarkClearance(card: RouteCard, envelope: TrackEnvelope): readonly string[] {
  return card.landmarks.flatMap((landmark) => {
    const footprint: TrackFootprint = {
      progress: landmark.progress,
      lateral: landmark.lateral,
      halfLength: landmark.footprint.halfLength * landmark.scale,
      halfWidth: landmark.footprint.halfWidth * landmark.scale,
      yaw: landmark.yaw,
    }
    return envelope.isFootprintClear(footprint) || !landmark.required
      ? []
      : [`required landmark ${landmark.id} exceeds the safety envelope`]
  })
}

function classify(absoluteLateral: number, tokens: TrackEnvelopeTokens): TrackSurfaceClassification {
  if (absoluteLateral <= tokens.asphaltHalfWidth) return 'asphalt'
  if (absoluteLateral <= tokens.kerbOuterOffset) return 'kerb'
  if (absoluteLateral <= tokens.runoffOuterOffset) return 'runoff'
  if (absoluteLateral < tokens.barrierInnerOffset) return 'verge'
  if (absoluteLateral <= tokens.sceneryClearanceOffset) return 'barrier'
  return 'outside'
}

function normalizeProgress(progress: number): number {
  return ((progress % 1) + 1) % 1
}
