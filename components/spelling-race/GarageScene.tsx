'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { KartColour } from '@/lib/spelling-race/types'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import { applyKartPaint, createKartFromTemplate, disposeObject3D, readGrandPrixPalette, type GrandPrixPalette } from './kartModel'

type GarageSceneProps = {
  colour: KartColour
  assets: LoadedWorldAssets
}

export default function GarageScene({ colour, assets }: GarageSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kartRef = useRef<THREE.Group | null>(null)
  const paletteRef = useRef<GrandPrixPalette | null>(null)
  const colourRef = useRef(colour)

  useEffect(() => {
    colourRef.current = colour
    const kart = kartRef.current
    const palette = paletteRef.current
    if (kart && palette) applyKartPaint(kart, colour, palette)
  }, [colour])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    let readGaragePaint: (() => string | null) | undefined

    const palette = readGrandPrixPalette()
    paletteRef.current = palette
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(palette.gantry)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    camera.position.set(5.5, 3.8, 7.5)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))

    scene.add(new THREE.HemisphereLight(palette.ambient, palette.gantry, 2.2))
    const key = new THREE.DirectionalLight(palette.sun, 2.8)
    key.position.set(3, 7, 4)
    key.castShadow = true
    key.shadow.mapSize.set(512, 512)
    scene.add(key)
    const fill = new THREE.PointLight(palette.barrierTeal, 9, 12)
    fill.position.set(-4, 3.6, 1)
    scene.add(fill)

    buildGarage(scene, palette)
    const template = assets.models.get('kart')
    if (!template) throw new Error('Loaded world model missing: kart')
    const kart = createKartFromTemplate(template, colourRef.current, palette, 'garage')
    kart.rotation.y = -0.45
    kart.position.y = 0.05
    scene.add(kart)
    kartRef.current = kart
    if (process.env.NODE_ENV !== 'production') {
      readGaragePaint = () => readKartBodyColour(kartRef.current)
      ;(window as Window & { __tinyGrandPrixGaragePaint?: () => string | null })
        .__tinyGrandPrixGaragePaint = readGaragePaint
    }
    renderer.render(scene, camera)

    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startedAt = performance.now()
    let frame = 0
    const render = (now: number) => {
      const elapsed = now - startedAt
      if (!reducedMotion) {
        const progress = Math.min(elapsed / 5_000, 1)
        camera.position.set(5.5 - progress * 1.4, 3.8, 7.5 - progress * 0.8)
      }
      camera.lookAt(0, 0.75, 0)
      renderer.render(scene, camera)
      if (!reducedMotion && elapsed < 5_000) frame = window.requestAnimationFrame(render)
    }
    frame = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      disposeObject3D(scene)
      renderer.renderLists.dispose()
      renderer.dispose()
      kartRef.current = null
      paletteRef.current = null
      const testWindow = window as Window & { __tinyGrandPrixGaragePaint?: () => string | null }
      if (readGaragePaint && testWindow.__tinyGrandPrixGaragePaint === readGaragePaint) {
        delete testWindow.__tinyGrandPrixGaragePaint
      }
    }
  }, [assets])

  return (
    <div
      ref={containerRef}
      data-testid="garage-scene"
      data-kart-colour={colour}
      className="relative min-h-56 w-full overflow-hidden rounded-xl border"
      style={{ background: 'var(--grand-prix-gantry)', borderColor: 'var(--line)' }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  )
}

function readKartBodyColour(kart: THREE.Object3D | null): string | null {
  const body = kart?.getObjectByName('paint_body')
  if (!(body instanceof THREE.Mesh)) return null
  const candidate = Array.isArray(body.material) ? body.material[0] : body.material
  const paint = candidate as THREE.Material & { color?: THREE.Color }
  return paint.color ? `#${paint.color.getHexString()}` : null
}

function buildGarage(scene: THREE.Scene, palette: GrandPrixPalette): void {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 13), new THREE.MeshStandardMaterial({ color: palette.asphalt, roughness: 0.92 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMaterial = new THREE.MeshStandardMaterial({ color: palette.gantry, roughness: 0.78 })
  const pitWall = new THREE.Mesh(new THREE.BoxGeometry(12, 3.6, 0.38), wallMaterial)
  pitWall.position.set(0, 1.8, -3.9)
  pitWall.receiveShadow = true
  scene.add(pitWall)

  const gantryMaterial = new THREE.MeshStandardMaterial({ color: palette.gantryPost, roughness: 0.42, metalness: 0.2 })
  const gantry = new THREE.Group()
  ;[-3.8, 3.8].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.4, 0.24), gantryMaterial)
    post.position.set(x, 2.2, -0.6)
    gantry.add(post)
  })
  const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.24, 0.28), gantryMaterial)
  beam.position.set(0, 4.25, -0.6)
  gantry.add(beam)
  scene.add(gantry)

  const softboxMaterial = new THREE.MeshBasicMaterial({ color: palette.kartStripe })
  ;[-2.4, 0, 2.4].forEach((x) => {
    const softbox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.74), softboxMaterial)
    softbox.position.set(x, 4.04, -0.48)
    scene.add(softbox)
  })

  const tyreMaterial = new THREE.MeshStandardMaterial({ color: palette.tyre, roughness: 0.9 })
  const tyreGeometry = new THREE.TorusGeometry(0.45, 0.17, 12, 20)
  ;[[-4.2, -2.45], [-3.25, -2.45], [4.1, -2.4]].forEach(([x, z], index) => {
    const stacks = index === 2 ? 2 : 3
    for (let level = 0; level < stacks; level += 1) {
      const tyre = new THREE.Mesh(tyreGeometry, tyreMaterial)
      tyre.rotation.x = Math.PI / 2
      tyre.position.set(x, 0.43 + level * 0.36, z)
      tyre.castShadow = true
      scene.add(tyre)
    }
  })

  const toolMaterial = new THREE.MeshStandardMaterial({ color: palette.barrierYellow, roughness: 0.58, metalness: 0.18 })
  const toolRack = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 0.08), toolMaterial)
  toolRack.position.set(3.5, 2.25, -3.66)
  scene.add(toolRack)
  ;[-0.72, -0.24, 0.24, 0.72].forEach((offset) => {
    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), toolMaterial)
    tool.position.set(3.5 + offset, 1.77, -3.62)
    scene.add(tool)
  })
}
