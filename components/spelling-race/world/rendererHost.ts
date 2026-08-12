import * as THREE from 'three'
import type { RaceState } from '@/lib/spelling-race/raceSimulation'
import type { KartColour } from '@/lib/spelling-race/types'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import { worldProgressAt } from '@/lib/spelling-race/world/progress'
import {
  createQualityState,
  profileFor,
  rememberStableTier,
  sampleQuality,
  type QualityState,
  type QualityTier,
} from '@/lib/spelling-race/world/quality'
import {
  createActiveFrameTrace,
  listenForVisibilityTransitions,
  resetRendererSampling,
} from '@/lib/spelling-race/world/rendererSession'
import type { RouteCard, RouteId } from '@/lib/spelling-race/world/types'
import { resolveVisualKartPoses, type VisualKartPose } from '@/lib/spelling-race/world/visualPose'
import type { GantryPromptHandle } from '../GantryPrompt'
import {
  applyKartPaint,
  createCarFromTemplate,
  createKartFromTemplate,
  disposeObject3D,
  readGrandPrixPalette,
  type GrandPrixPalette,
} from '../kartModel'
import { createDistrictWorld } from './districts'
import { createRaceGantry, validateRaceGantry } from './gantry'
import {
  configureSharedWorld,
  createSharedWorld,
  createWorldDisposalScope,
  HIGH_BOOST_PARTICLES,
  HIGH_SPEED_STREAKS,
  updateBoostParticles,
  updateSpeedStreaks,
} from './sharedWorld'
import { placeOnTrack, sampleTrack, type TrackSample } from './track'
import {
  countVisibleShadowCasters,
  createSignBoardRectProjector,
  type SignBoardRect,
} from './visualDiagnostics'

export type RendererHostProps = {
  race: RaceState
  activeWord: string | null
  turboRatio: number
  playerColour: KartColour
  reducedMotion: boolean
  paused: boolean
  route: RouteCard
  assets: LoadedWorldAssets
  equippedCarModel: THREE.Group | null
  onContextLost(): void
}

export type VisualDiagnostics = {
  routeId: RouteId
  tier: QualityTier
  calls: number
  triangles: number
  textures: number
  frameTimesMs: readonly number[]
  signBoardRect: SignBoardRect | null
  shadowCasters: number
}

export type RendererHost = {
  update(nextProps: RendererHostProps): void
  dispose(): void
}

type RendererHostInput = {
  container: HTMLDivElement
  canvas: HTMLCanvasElement
  prompt: GantryPromptHandle
  props: RendererHostProps
}

type VisualCheckpoint = 'void-deck-grid' | 'hawker-sweep' | 'rail-shophouse-turn'

const RIVAL_LANES = [-0.45, 0.1, 0.52] as const
const CHECKPOINT_PROGRESS: Readonly<Record<VisualCheckpoint, number>> = {
  'void-deck-grid': 0.03,
  'hawker-sweep': 0.31,
  'rail-shophouse-turn': 0.72,
}
const VIEWPORT_MARGIN = 16

export function createRendererHost({ container, canvas, prompt, props }: RendererHostInput): RendererHost {
  if (props.assets.routeId !== props.route.id) {
    throw new Error(`Loaded route ${props.assets.routeId} does not match ${props.route.id}`)
  }

  const kartTemplate = requiredModel(props.assets, 'kart')
  const visualDebugBuild = process.env.NODE_ENV !== 'production'
  const palette = readGrandPrixPalette()
  const scope = createWorldDisposalScope()
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 180)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  scope.defer(() => renderer.dispose())
  scope.defer(() => renderer.renderLists.dispose())
  scope.defer(() => disposeObject3D(scene))

  const initialized = (() => {
    try {
      const shared = createSharedWorld({ card: props.route, assets: props.assets, palette })
      configureSharedWorld(scene, renderer, shared)
      const district = createDistrictWorld(props.route, props.assets, palette)
      scene.add(district.root)
      scope.defer(() => district.dispose())

      const gantryModel = createRaceGantry(shared.track.envelope)
      const gantryErrors = validateRaceGantry(gantryModel)
      if (gantryErrors.length > 0) throw new Error(gantryErrors.join(', '))
      shared.gantry.children.forEach((child) => { child.visible = false })
      shared.gantry.add(gantryModel)
      const signAnchor = gantryModel.getObjectByName('sign_anchor')
      if (!signAnchor) throw new Error('Gantry template missing named part: sign_anchor')
      const signFrame = visualDebugBuild ? gantryModel.getObjectByName('display_surface') : undefined
      const signBoardProjector = signFrame instanceof THREE.Mesh ? createSignBoardRectProjector(signFrame) : null

      const player = props.equippedCarModel
        ? createCarFromTemplate(props.equippedCarModel, props.playerColour, palette, 'player')
        : createKartFromTemplate(kartTemplate, props.playerColour, palette, 'player')
      player.name = 'player-kart'
      scene.add(player)
      const rivals = props.race.rivals.map((rival) => {
        const kart = createKartFromTemplate(kartTemplate, rival.colour, palette, 'rival')
        kart.name = `rival-kart-${rival.id}`
        scene.add(kart)
        return kart
      })
      return { shared, district, signAnchor, signBoardProjector, player, rivals }
    } catch (error) {
      scope.dispose()
      throw error
    }
  })()
  const { shared, district, signAnchor, signBoardProjector, player, rivals } = initialized

  const playerSample = trackSample()
  const kartSample = trackSample()
  const gantrySample = trackSample()
  const cameraGoal = new THREE.Vector3()
  const lookGoal = new THREE.Vector3()
  const lookCurrent = new THREE.Vector3()
  const projected = new THREE.Vector3()
  const cameraSpace = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const particlePosition = new THREE.Vector3()
  const particleScale = new THREE.Vector3()
  const particleQuaternion = new THREE.Quaternion()
  const frameTrace = createActiveFrameTrace()
  const checkpoint = developmentCheckpoint()

  let currentProps = props
  let previousRace = props.race
  let snapshotAt = performance.now()
  let lastFrame: number | null = snapshotAt
  let visualSeconds = 0
  let cameraReady = false
  let animationFrame = 0
  let disposed = false
  let width = 1
  let height = 1
  let qualityState: QualityState = createQualityState(snapshotAt, checkpoint ? 'high' : undefined)
  let qualityProfile = profileFor(qualityState.tier)
  let publishedDiagnostics: VisualDiagnostics | undefined
  let syntheticQualityNow = snapshotAt

  const resize = () => {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityProfile.dprCap))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const applyQuality = (tier: QualityTier, remember: boolean) => {
    qualityProfile = profileFor(tier)
    container.dataset.quality = tier
    shared.sun.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize)
    shared.sun.shadow.map?.dispose()
    shared.sun.shadow.map = null
    district.setQuality(tier)
    if (remember) rememberStableTier(tier)
    resize()
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  scope.defer(() => resizeObserver.disconnect())

  const handleContextLost = (event: Event) => {
    event.preventDefault()
    currentProps.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', handleContextLost)
  scope.defer(() => canvas.removeEventListener('webglcontextlost', handleContextLost))
  scope.defer(() => window.cancelAnimationFrame(animationFrame))
  scope.defer(listenForVisibilityTransitions(document, () => {
    const now = performance.now()
    qualityState = resetRendererSampling(qualityState, now, frameTrace)
    lastFrame = null
  }))

  applyQuality(qualityState.tier, false)

  const renderFrame = (now: number) => {
    if (disposed) return
    const frameTimeMs = lastFrame === null ? 0 : Math.max(0, now - lastFrame)
    const deltaSeconds = Math.min(frameTimeMs / 1_000, 0.1)
    lastFrame = now
    if (!currentProps.paused && !checkpoint) visualSeconds += deltaSeconds
    if (checkpoint) visualSeconds = 1.25

    const snapshot = currentProps.race
    const snapshotAlpha = currentProps.paused || checkpoint ? 1 : clamp01((now - snapshotAt) / 34)
    const checkpointProgress = checkpoint ? worldProgressAt(CHECKPOINT_PROGRESS[checkpoint]) : undefined
    const playerProgress = checkpointProgress ?? THREE.MathUtils.lerp(
      previousRace.player.progress,
      snapshot.player.progress,
      snapshotAlpha,
    )
    const playerLateralPosition = checkpoint ? 0 : THREE.MathUtils.lerp(
      previousRace.player.lateralPosition,
      snapshot.player.lateralPosition,
      snapshotAlpha,
    )
    const requestedPoses: VisualKartPose[] = [{ id: 'player', progress: playerProgress, lateral: playerLateralPosition }]
    snapshot.rivals.forEach((rival, index) => {
      const previousRival = previousRace.rivals[index]
      const rivalProgress = checkpointProgress === undefined
        ? previousRival
          ? THREE.MathUtils.lerp(previousRival.progress, rival.progress, snapshotAlpha)
          : rival.progress
        : checkpointProgress + (index - 1) * 4
      requestedPoses.push({ id: rival.id, progress: rivalProgress, lateral: RIVAL_LANES[index] ?? 0 })
    })
    const poses = resolveVisualKartPoses(requestedPoses, { minProgressGap: 0.018, lateralBounds: [-1, 1] })
    const playerPose = poses.find((pose) => pose.id === 'player')!
    placeOnTrack(player, shared.track, playerPose.progress, playerPose.lateral, kartSample)
    snapshot.rivals.forEach((rival, index) => {
      const visual = rivals[index]
      const pose = poses.find((candidate) => candidate.id === rival.id)
      if (visual && pose) placeOnTrack(visual, shared.track, pose.progress, pose.lateral, kartSample)
    })

    sampleTrack(shared.track, playerProgress, playerLateralPosition, playerSample)
    sampleTrack(shared.track, playerProgress + worldProgressAt(0.055), 0, gantrySample)
    shared.gantry.position.copy(gantrySample.point)
    shared.gantry.position.y = 0
    shared.gantry.rotation.y = Math.atan2(gantrySample.tangent.x, gantrySample.tangent.z)

    cameraGoal.copy(playerSample.point).addScaledVector(playerSample.tangent, -6.2)
    cameraGoal.y += 2.85
    lookGoal.copy(playerSample.point).addScaledVector(playerSample.tangent, 9)
    lookGoal.y += 1.15

    if (!cameraReady || checkpoint) {
      camera.position.copy(cameraGoal)
      lookCurrent.copy(lookGoal)
      cameraReady = true
    } else if (!currentProps.paused) {
      const cameraBlend = currentProps.reducedMotion
        ? 1 - Math.exp(-deltaSeconds * 9)
        : 1 - Math.exp(-deltaSeconds * 5)
      camera.position.lerp(cameraGoal, cameraBlend)
      lookCurrent.lerp(lookGoal, cameraBlend)
    }

    const boost = clamp01(snapshot.player.boost)
    const targetFov = currentProps.reducedMotion ? 53 : 53 + boost * 3
    camera.fov += (targetFov - camera.fov) * (currentProps.reducedMotion || checkpoint ? 1 : 0.08)
    camera.updateProjectionMatrix()
    camera.lookAt(lookCurrent)
    camera.updateMatrixWorld(true)
    scene.updateMatrixWorld(true)

    const particleMultiplier = qualityProfile.particleScale
    updateSpeedStreaks(
      shared.speedStreaks,
      playerSample.point,
      playerSample.tangent,
      playerSample.right,
      visualSeconds,
      currentProps.reducedMotion ? 0 : Math.ceil(HIGH_SPEED_STREAKS * particleMultiplier),
    )
    updateBoostParticles(
      shared.boostParticles.mesh,
      playerSample.point,
      playerSample.tangent,
      playerSample.right,
      visualSeconds,
      currentProps.reducedMotion ? 0 : Math.ceil(HIGH_BOOST_PARTICLES * boost * particleMultiplier),
      matrix,
      particlePosition,
      particleQuaternion,
      particleScale,
    )

    projectPrompt(signAnchor, camera, prompt.element, projected, cameraSpace, width, height)
    renderer.render(scene, camera)

    const visible = document.visibilityState === 'visible'
    if (!checkpoint) {
      const syntheticFrameTimeMs = developmentSyntheticFrameTimeMs()
      syntheticQualityNow = syntheticFrameTimeMs === undefined ? now : syntheticQualityNow + syntheticFrameTimeMs
      const sampled = sampleQuality(qualityState, syntheticQualityNow, visible && !currentProps.paused)
      qualityState = sampled.state
      if (sampled.changed) applyQuality(qualityState.tier, true)
    }
    if (developmentVisualDebug()) {
      const signBoardRect = signBoardProjector?.project(camera, width, height) ?? null
      const shadowCasters = countVisibleShadowCasters(scene)
      publishSceneContracts(container, currentProps.route, shared, district.root, player, rivals)
      frameTrace.recordFrame(now, { paused: currentProps.paused, visible })
      if (frameTrace.started) {
        if (!publishedDiagnostics) {
          publishedDiagnostics = {
            routeId: currentProps.route.id,
            tier: qualityState.tier,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            textures: renderer.info.memory.textures,
            frameTimesMs: frameTrace.frameTimesMs,
            signBoardRect,
            shadowCasters,
          }
          window.__tinyGrandPrixVisualDiagnostics = publishedDiagnostics
        } else {
          publishedDiagnostics.routeId = currentProps.route.id
          publishedDiagnostics.tier = qualityState.tier
          publishedDiagnostics.calls = renderer.info.render.calls
          publishedDiagnostics.triangles = renderer.info.render.triangles
          publishedDiagnostics.textures = renderer.info.memory.textures
          publishedDiagnostics.signBoardRect = signBoardRect
          publishedDiagnostics.shadowCasters = shadowCasters
        }
      }
    } else {
      clearPublishedDiagnostics(publishedDiagnostics)
      publishedDiagnostics = undefined
      clearSceneContracts(container)
    }
    animationFrame = window.requestAnimationFrame(renderFrame)
  }

  animationFrame = window.requestAnimationFrame(renderFrame)

  return {
    update(nextProps) {
      if (disposed) return
      if (nextProps.paused && !currentProps.paused) frameTrace.resetBaseline()
      if (nextProps.race !== currentProps.race) {
        previousRace = currentProps.race
        snapshotAt = performance.now()
      }
      if (nextProps.playerColour !== currentProps.playerColour) {
        applyKartPaint(player, nextProps.playerColour, palette)
      }
      nextProps.race.rivals.forEach((rival, index) => {
        const kart = rivals[index]
        if (kart && kart.userData.kartColour !== rival.colour) applyKartPaint(kart, rival.colour, palette)
      })
      currentProps = nextProps
    },
    dispose() {
      if (disposed) return
      disposed = true
      prompt.element.style.visibility = 'hidden'
      clearPublishedDiagnostics(publishedDiagnostics)
      clearSceneContracts(container)
      scope.dispose()
    },
  }
}

function requiredModel(assets: LoadedWorldAssets, id: 'kart'): THREE.Group {
  const model = assets.models.get(id)
  if (!model) throw new Error(`Loaded world model missing: ${id}`)
  return model
}

function projectPrompt(
  anchor: THREE.Object3D,
  camera: THREE.Camera,
  element: HTMLDivElement,
  projected: THREE.Vector3,
  cameraSpace: THREE.Vector3,
  width: number,
  height: number,
): void {
  anchor.getWorldPosition(projected)
  cameraSpace.copy(projected).applyMatrix4(camera.matrixWorldInverse)
  projected.project(camera)
  const x = (projected.x * 0.5 + 0.5) * width
  const y = (-projected.y * 0.5 + 0.5) * height
  const hidden = cameraSpace.z >= 0
    || !Number.isFinite(x)
    || !Number.isFinite(y)
    || x < VIEWPORT_MARGIN
    || x > width - VIEWPORT_MARGIN
    || y < VIEWPORT_MARGIN
    || y > height - VIEWPORT_MARGIN
  element.style.visibility = hidden ? 'hidden' : 'visible'
  if (!hidden) {
    element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
  }
}

function developmentCheckpoint(): VisualCheckpoint | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  const checkpoint = window.__tinyGrandPrixTest?.visualCheckpoint
  return checkpoint && checkpoint in CHECKPOINT_PROGRESS ? checkpoint : undefined
}

function developmentSyntheticFrameTimeMs(): number | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  const frameTimeMs = window.__tinyGrandPrixTest?.syntheticFrameTimeMs
  return typeof frameTimeMs === 'number' && Number.isFinite(frameTimeMs) && frameTimeMs > 0
    ? frameTimeMs
    : undefined
}

function developmentVisualDebug(): boolean {
  return process.env.NODE_ENV !== 'production'
    && new URLSearchParams(window.location.search).get('visual-debug') === '1'
}

function publishSceneContracts(
  container: HTMLDivElement,
  route: RouteCard,
  shared: ReturnType<typeof createSharedWorld>,
  districtRoot: THREE.Group,
  player: THREE.Group,
  rivals: readonly THREE.Group[],
): void {
  container.dataset.routeId = route.id
  container.dataset.districtId = districtRoot.name
  container.dataset.circuitPointCount = String(route.circuit.points.length)
  container.dataset.landmarkAssetIds = [...new Set(route.landmarks.map((landmark) => landmark.assetId))].sort().join(',')
  container.dataset.sharedKartCount = String(1 + rivals.length)
  container.dataset.sharedGantry = String(shared.gantry.visible)
  container.dataset.playerVisible = String(player.visible)
  container.dataset.rivalCount = String(rivals.filter((rival) => rival.visible).length)
  container.dataset.roadVisible = String(shared.track.root.getObjectByName('track-asphalt')?.visible === true)
  container.dataset.kerbMeshCount = String(shared.track.root.children.filter((child) => (
    child instanceof THREE.InstancedMesh && child.receiveShadow && !child.castShadow
  )).length)
}

function clearSceneContracts(container: HTMLDivElement): void {
  for (const key of [
    'routeId', 'districtId', 'circuitPointCount', 'landmarkAssetIds', 'sharedKartCount',
    'sharedGantry', 'playerVisible', 'rivalCount', 'roadVisible', 'kerbMeshCount',
  ] as const) delete container.dataset[key]
}

function clearPublishedDiagnostics(publishedDiagnostics: VisualDiagnostics | undefined): void {
  if (publishedDiagnostics && window.__tinyGrandPrixVisualDiagnostics === publishedDiagnostics) {
    delete window.__tinyGrandPrixVisualDiagnostics
  }
}

function trackSample(): TrackSample {
  return {
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
