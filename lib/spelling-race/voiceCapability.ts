import type { VoiceGateState } from './types'

export const SPEECH_LANGUAGE = 'en-SG'
export const SPEECH_MIN_CONFIDENCE = 0.8

export type VoiceEnvironment = {
  secureContext: boolean
  hasMediaDevices: boolean
  hasRecognitionConstructor: boolean
}

export type RecognitionPort = {
  start: (
    onResult: (candidates: readonly string[], isFinal: boolean, segmentId: number) => void,
    onError: (code: string) => void,
    onEnd: () => void,
    onStart?: () => void,
  ) => void
  stop: () => void
  abort: () => void
}

export function inspectVoiceEnvironment(environment: VoiceEnvironment): {
  state: VoiceGateState
  message: string
} {
  if (!environment.secureContext) {
    return {
      state: 'unsupported',
      message: 'Voice recognition needs a secure connection. Open this page in current Safari on iPad and try again.',
    }
  }

  if (!environment.hasMediaDevices || !environment.hasRecognitionConstructor) {
    return {
      state: 'unsupported',
      message:
        'Voice recognition is not available in this browser right now. Try current Safari on iPad; Siri/speech features may need to be enabled.',
    }
  }

  return { state: 'ready', message: 'Voice is ready.' }
}

export function voiceGateForError(code: string): { state: VoiceGateState; message: string } {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return {
      state: 'permission-denied',
      message: 'Microphone access is off. Allow it for this site in iPad/Safari settings, then try again.',
    }
  }

  if (code === 'no-speech' || code === 'aborted') {
    return { state: 'listening-interrupted', message: "I didn't catch that. Let's try again." }
  }

  return {
    state: 'service-error',
    message: 'Voice service could not be reached. Check your connection and try again.',
  }
}

export function createRecognitionPort(
  browser: Partial<Pick<Window, 'SpeechRecognition' | 'webkitSpeechRecognition' | '__spellingRaceVoice'>>,
): RecognitionPort | null {
  if (process.env.NODE_ENV !== 'production' && browser.__spellingRaceVoice) {
    return {
      start: (onResult, onError, onEnd, onStart) => {
        onStart?.()
        browser.__spellingRaceVoice?.start(
          (value) => onResult(typeof value === 'string' ? [value] : value, true, 0),
          onError,
          onEnd,
        )
      },
      stop: () => {
        if (browser.__spellingRaceVoice?.stop) browser.__spellingRaceVoice.stop()
        else browser.__spellingRaceVoice?.abort()
      },
      abort: () => browser.__spellingRaceVoice?.abort(),
    }
  }

  const RecognitionConstructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
  if (!RecognitionConstructor) return null

  let recognition: SpeechRecognition | null = null

  return {
    start(onResult, onError, onEnd, onStart) {
      recognition = new RecognitionConstructor()
      recognition.lang = SPEECH_LANGUAGE
      if ('continuous' in recognition) recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 5
      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex ?? 0]
        if (!result) return
        onResult(
          Array.from({ length: result.length }, (_, index) => result[index]?.transcript)
            .filter((transcript, index) => {
              if (!transcript) return false
              const confidence = result[index]?.confidence ?? 0
              return confidence >= SPEECH_MIN_CONFIDENCE
            }),
          result.isFinal,
          event.resultIndex ?? 0,
        )
      }
      recognition.onerror = (event) => onError(event.error)
      recognition.onend = onEnd
      recognition.onstart = onStart ?? null
      try {
        recognition.start()
      } catch {
        onError('start-failed')
        onEnd()
      }
    },
    stop() {
      recognition?.stop()
    },
    abort() {
      recognition?.abort()
    },
  }
}
