interface SpeechRecognitionAlternative {
  transcript: string
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognition {
  lang: string
  continuous?: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

type TinyGrandPrixAssetDiagnostics = {
  readonly routeId: import('@/lib/spelling-race/world/types').RouteId
  readonly missingOptionalAssetIds: readonly import('@/lib/spelling-race/world/types').AssetId[]
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
  __spellingRaceVoice?: {
    start(
      onResult: (candidates: readonly string[] | string) => void,
      onError: (code: string) => void,
      onEnd: () => void,
    ): void
    stop?(): void
    abort(): void
  }
  __spellingRaceTilt?: {
    requestPermission(): Promise<'granted' | 'fallback'>
    calibrate(): number
    subscribe(listener: (steering: number) => void): () => void
    destroy(): void
  }
  __tinyGrandPrixTest?: {
    seed: number
    timeScale: number
    countdownMs: number
    visualCheckpoint?: 'void-deck-grid' | 'hawker-sweep' | 'rail-shophouse-turn'
    failAssetId?: import('@/lib/spelling-race/world/types').WorldAssetId
    syntheticFrameTimeMs?: number
  }
  __tinyGrandPrixVisualDiagnostics?: import('@/components/spelling-race/world/rendererHost').VisualDiagnostics
  __tinyGrandPrixAssetDiagnostics?: TinyGrandPrixAssetDiagnostics
}
