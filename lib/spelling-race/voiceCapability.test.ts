import { describe, expect, it } from 'vitest'
import {
  createRecognitionPort,
  inspectVoiceEnvironment,
  SPEECH_LANGUAGE,
  SPEECH_MIN_CONFIDENCE,
  voiceGateForError,
} from './voiceCapability'

describe('inspectVoiceEnvironment', () => {
  it('is ready only on a secure browser with microphone and recognition support', () => {
    expect(
      inspectVoiceEnvironment({
        secureContext: true,
        hasMediaDevices: true,
        hasRecognitionConstructor: true,
      }),
    ).toEqual({ state: 'ready', message: 'Voice is ready.' })
  })

  it('reports unsupported before permission when recognition is absent', () => {
    expect(
      inspectVoiceEnvironment({
        secureContext: true,
        hasMediaDevices: true,
        hasRecognitionConstructor: false,
      }),
    ).toEqual({
      state: 'unsupported',
      message: 'Voice recognition is not available in this browser right now. Try current Safari on iPad; Siri/speech features may need to be enabled.',
    })
  })

  it('reports unsupported in an insecure context', () => {
    expect(
      inspectVoiceEnvironment({
        secureContext: false,
        hasMediaDevices: true,
        hasRecognitionConstructor: true,
      }).state,
    ).toBe('unsupported')
  })
})

describe('voiceGateForError', () => {
  it('keeps permission, service, and interrupted listening distinct', () => {
    expect(voiceGateForError('not-allowed').state).toBe('permission-denied')
    expect(voiceGateForError('network').state).toBe('service-error')
    expect(voiceGateForError('no-speech').state).toBe('listening-interrupted')
  })
})

describe('createRecognitionPort', () => {
  it('reports an interim result immediately instead of waiting for final silence', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }
    const received: unknown[][] = []
    const capture = (...args: unknown[]) => received.push(args)
    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })

    port?.start(capture, () => undefined, () => undefined)
    instances[0].onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, length: 1, 0: { transcript: 'cat', confidence: 0.9 } }],
    } as never)

    expect(instances[0].interimResults).toBe(true)
    expect(received).toEqual([[['cat'], false, 0]])
  })

  it('returns every alternative from the first final en-SG result', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }

    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })
    const received: string[][] = []
    const errors: string[] = []
    let ended = 0

    port?.start(
      (candidates) => received.push([...candidates]),
      (code) => errors.push(code),
      () => {
        ended += 1
      },
    )

    expect(instances[0]).toMatchObject({
      lang: SPEECH_LANGUAGE,
      interimResults: true,
      maxAlternatives: 5,
      starts: 1,
    })

    instances[0].onresult?.({
      results: [{ isFinal: true, length: 2, 0: { transcript: 'brite', confidence: 0.85 }, 1: { transcript: 'bright', confidence: 0.92 } }],
    } as never)
    instances[0].onerror?.({ error: 'network' } as never)
    instances[0].onend?.()

    expect(received).toEqual([['brite', 'bright']])
    expect(errors).toEqual(['network'])
    expect(ended).toBe(1)
  })

  it('uses resultIndex to read the newly-final result', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }
    const received: string[][] = []
    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })

    port?.start((candidates) => received.push([...candidates]), () => undefined, () => undefined)
    instances[0].onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, length: 1, 0: { transcript: 'go', confidence: 0.9 } }],
    } as never)
    instances[0].onresult?.({
      resultIndex: 1,
      results: [
        { isFinal: true, length: 1, 0: { transcript: 'go', confidence: 0.95 } },
        { isFinal: true, length: 2, 0: { transcript: 'cat', confidence: 0.88 }, 1: { transcript: 'kat', confidence: 0.81 } },
      ],
    } as never)

    expect(received).toEqual([['go'], ['cat', 'kat']])
  })

  it('falls back to the webkit constructor and returns null when absent', () => {
    class WebkitRecognition extends FakeRecognition {}

    expect(createRecognitionPort({ webkitSpeechRecognition: WebkitRecognition })).not.toBeNull()
    expect(createRecognitionPort({})).toBeNull()
  })

  it('uses the injected development voice port when present', () => {
    let started = false
    const port = createRecognitionPort({
      __spellingRaceVoice: {
        start() { started = true },
        abort() {},
      },
    } as never)

    port?.start(() => undefined, () => undefined, () => undefined)

    expect(started).toBe(true)
  })

  it('reports when native recognition has actually started listening', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }
    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })
    let listening = false

    port?.start(() => undefined, () => undefined, () => undefined, () => { listening = true })
    expect(listening).toBe(false)
    instances[0].onstart?.()
    expect(listening).toBe(true)
  })

  it('gracefully ends the current word turn without aborting recognition', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }
    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })

    port?.start(() => undefined, () => undefined, () => undefined)
    port?.stop()

    expect(instances[0]).toMatchObject({ starts: 1, stops: 1, aborts: 0 })
  })

  it('routes a synchronous native start failure through the error boundary', () => {
    class BrokenRecognition extends FakeRecognition {
      start() { throw new DOMException('Already active', 'InvalidStateError') }
    }
    const errors: string[] = []
    const port = createRecognitionPort({ SpeechRecognition: BrokenRecognition })

    expect(() => port?.start(() => undefined, (code) => errors.push(code), () => undefined)).not.toThrow()
    expect(errors).toEqual(['start-failed'])
  })

  it('keeps every recognition turn non-continuous', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        this.continuous = true
        instances.push(this)
      }
    }

    createRecognitionPort({ SpeechRecognition: StandardRecognition })?.start(() => undefined, () => undefined, () => undefined)

    expect(instances[0].continuous).toBe(false)
  })

  it('starts when the native object has no continuous setting', () => {
    const instances: FakeRecognition[] = []
    class LegacyRecognition extends FakeRecognition {
      constructor() {
        super()
        delete this.continuous
        instances.push(this)
      }
    }

    createRecognitionPort({ SpeechRecognition: LegacyRecognition })?.start(() => undefined, () => undefined, () => undefined)

    expect(instances[0].starts).toBe(1)
    expect('continuous' in instances[0]).toBe(false)
  })

  it('filters out candidates below SPEECH_MIN_CONFIDENCE (0.8)', () => {
    const instances: FakeRecognition[] = []
    class StandardRecognition extends FakeRecognition {
      constructor() {
        super()
        instances.push(this)
      }
    }
    const received: string[][] = []
    const port = createRecognitionPort({ SpeechRecognition: StandardRecognition })

    port?.start((candidates) => received.push([...candidates]), () => undefined, () => undefined)
    instances[0].onresult?.({
      results: [{
        isFinal: true,
        length: 4,
        0: { transcript: 'cat', confidence: 0.95 },
        1: { transcript: 'kat', confidence: 0.72 },
        2: { transcript: 'bat', confidence: 0.80 },
        3: { transcript: 'cap' },
      }],
    } as never)

    // 'kat' (0.72) is below 0.8 and 'cap' (no confidence → 0) are filtered out
    expect(received).toEqual([['cat', 'bat']])
    expect(SPEECH_MIN_CONFIDENCE).toBe(0.8)
  })
})

class FakeRecognition {
  lang = ''
  continuous: boolean | undefined = false
  interimResults = true
  maxAlternatives = 0
  starts = 0
  stops = 0
  aborts = 0
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null

  start() {
    this.starts += 1
  }

  stop() {
    this.stops += 1
  }

  abort() {
    this.aborts += 1
  }
}
