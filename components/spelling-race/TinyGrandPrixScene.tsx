'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import type { RaceState } from '@/lib/spelling-race/raceSimulation'
import type { KartColour } from '@/lib/spelling-race/types'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import GantryPrompt, { type GantryPromptHandle } from './GantryPrompt'
import { createRendererHost, type RendererHost } from './world/rendererHost'

export type TinyGrandPrixSceneProps = {
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

export default function TinyGrandPrixScene(props: TinyGrandPrixSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const promptRef = useRef<GantryPromptHandle>(null)
  const hostRef = useRef<RendererHost>(null)
  const propsRef = useRef(props)

  useEffect(() => {
    propsRef.current = props
    hostRef.current?.update(props)
  }, [props])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const prompt = promptRef.current
    if (!container || !canvas || !prompt) return

    try {
      const host = createRendererHost({ container, canvas, prompt, props: propsRef.current })
      hostRef.current = host
      return () => {
        if (hostRef.current === host) hostRef.current = null
        host.dispose()
      }
    } catch {
      propsRef.current.onContextLost()
    }
  }, [props.assets, props.route])

  return (
    <div
      ref={containerRef}
      data-quality="high"
      className="ui-font relative min-h-[360px] w-full overflow-hidden rounded-xl border sm:min-h-[430px]"
      style={{ background: 'var(--grand-prix-sky)', borderColor: 'var(--line)' }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full touch-none" />
      <GantryPrompt ref={promptRef} activeWord={props.activeWord} />
    </div>
  )
}
