import type { RacePlacement } from './types'

export type RaceAudio = {
  unlock(): Promise<void>
  startRace(): void
  setEngine(speed: number): void
  boost(ratio: number): void
  setSurface(surface: 'track' | 'grass'): void
  lap(value: number): void
  timeout(): void
  finish(place: RacePlacement): void
  duck(value: boolean): void
  pause(): void
  resume(): void
  setMuted(value: boolean): void
  destroy(): void
}

type AudioContextLike = AudioContext
type AudioHost = {
  AudioContext?: new () => AudioContextLike
  webkitAudioContext?: new () => AudioContextLike
}

const ENGINE_LOOP_PATH = '/spelling-race/assets/audio/f1-engine-loop.mp3'
const BOOST_PATH = '/spelling-race/assets/audio/f1-boost.mp3'

/** playbackRate range: idle → redline. Kept low for a deep, meaty tone. */
const ENGINE_IDLE_RATE = 0.38
const ENGINE_REDLINE = 1.05
/** How far the rate drops on a gear shift (0–1). Lower = harder kick. */
const SHIFT_DIP = 0.72
/** Seconds between shifts at idle / max speed. */
const SHIFT_INTERVAL_MIN = 3.0
const SHIFT_INTERVAL_MAX = 5.0

export function createRaceAudio(host: AudioHost = typeof window === 'undefined' ? {} : window): RaceAudio {
  let context: AudioContextLike | null = null
  let master: GainNode | null = null
  let lowpass: BiquadFilterNode | null = null

  // Sample-based engine
  let engineBuffer: AudioBuffer | null = null
  let engineSource: AudioBufferSourceNode | null = null
  let engineGain: GainNode | null = null
  let engineLowpass: BiquadFilterNode | null = null

  // Boost one-shot
  let boostBuffer: AudioBuffer | null = null

  // Grass noise
  let grassSource: AudioBufferSourceNode | null = null
  let grassGain: GainNode | null = null

  // Gear-shift state
  let gearFloor = ENGINE_IDLE_RATE
  let nextShiftAt = 0
  let muted = false
  let ducked = false
  let buffersLoaded = false

  function updateMaster() {
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : ducked ? 0.18 : 1, context.currentTime, 0.03)
  }

  function chirp(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
  ) {
    if (!context || !master) return
    const now = context.currentTime + delay
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(master)
    osc.start(now)
    osc.stop(now + duration)
  }

  async function loadBuffers(): Promise<void> {
    if (buffersLoaded || !context) return
    const [engineResponse, boostResponse] = await Promise.all([
      fetch(ENGINE_LOOP_PATH),
      fetch(BOOST_PATH),
    ])
    const [engineData, boostData] = await Promise.all([
      engineResponse.arrayBuffer(),
      boostResponse.arrayBuffer(),
    ])
    engineBuffer = await context.decodeAudioData(engineData)
    boostBuffer = await context.decodeAudioData(boostData)
    buffersLoaded = true
  }

  function ensureEngine() {
    if (!context || !master || !engineBuffer || engineSource) return
    engineSource = context.createBufferSource()
    engineGain = context.createGain()
    engineLowpass = context.createBiquadFilter()
    engineLowpass.type = 'lowpass'
    engineLowpass.frequency.value = 1800
    engineLowpass.Q.value = 0.5
    engineSource.buffer = engineBuffer
    engineSource.loop = true
    engineSource.playbackRate.value = ENGINE_IDLE_RATE
    engineGain.gain.value = 0.16
    engineSource.connect(engineLowpass).connect(engineGain).connect(master)
    engineSource.start()
    nextShiftAt = context.currentTime + randomShiftInterval()
  }

  function ensureGrass() {
    if (!context || !master || grassSource) return
    const noise = context.createBuffer(1, context.sampleRate >>> 0, context.sampleRate >>> 0)
    const samples = noise.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1
    grassSource = context.createBufferSource()
    grassGain = context.createGain()
    grassSource.buffer = noise
    grassSource.loop = true
    grassGain.gain.value = 0
    grassSource.connect(grassGain).connect(master)
    grassSource.start()
  }

  function randomShiftInterval(): number {
    return SHIFT_INTERVAL_MIN + Math.random() * (SHIFT_INTERVAL_MAX - SHIFT_INTERVAL_MIN)
  }

  /** Simulate a gear shift: brief RPM dip + mechanical "thunk". */
  function triggerShift(ratio: number) {
    if (!context || !engineSource) return
    const now = context.currentTime
    nextShiftAt = now + randomShiftInterval()
    // Drop playbackRate briefly
    const dipTarget = gearFloor * SHIFT_DIP
    engineSource.playbackRate.setTargetAtTime(dipTarget, now, 0.015)
    // Climb to the new gear floor
    const newFloor = ENGINE_IDLE_RATE + ratio * (ENGINE_REDLINE - ENGINE_IDLE_RATE) * 0.62
    engineSource.playbackRate.setTargetAtTime(newFloor, now + 0.06, 0.1)
    gearFloor = newFloor
    // Mechanical thunk
    chirp(70, 32, 0.08, 'triangle', 0.06)
  }

  return {
    async unlock() {
      let created = false
      if (!context) {
        const AudioContextConstructor = host.AudioContext ?? host.webkitAudioContext
        if (!AudioContextConstructor) return
        context = new AudioContextConstructor()
        created = true
        master = context.createGain()
        lowpass = context.createBiquadFilter()
        lowpass.type = 'lowpass'
        lowpass.frequency.value = 2400
        lowpass.Q.value = 0.4
        master.connect(lowpass).connect(context.destination)
        updateMaster()
      }
      if (context.state === 'suspended') await context.resume()
      await loadBuffers()
      if (created) chirp(440, 660, 0.06, 'sine', 0.06)
    },
    startRace() {
      ensureEngine()
      ensureGrass()
      chirp(330, 330, 0.1, 'square', 0.1)
      chirp(440, 440, 0.1, 'square', 0.1, 0.4)
      chirp(660, 880, 0.18, 'square', 0.14, 0.8)
    },
    setEngine(rawSpeed: number) {
      if (!context || !engineSource || !engineGain) return
      const ratio = Math.max(0, Math.min(1, rawSpeed))
      const now = context.currentTime

      // Gear-shift logic — fire at a random 3–5 s interval
      if (now >= nextShiftAt) {
        triggerShift(ratio)
      } else {
        // Climb RPM within current gear toward redline
        const remaining = nextShiftAt - now
        const total = randomShiftInterval() // approximate for progress
        const progress = 1 - remaining / Math.max(total, 0.01)
        const climb = gearFloor + (ENGINE_REDLINE - gearFloor) * Math.min(progress, 1) * 0.7
        engineSource.playbackRate.setTargetAtTime(Math.min(climb, ENGINE_REDLINE), now, 0.1)
      }

      engineGain.gain.setTargetAtTime(0.09 + ratio * 0.09, now, 0.06)
    },
    boost(ratio) {
      if (!context || !master || !boostBuffer) return
      const amount = Math.max(0, Math.min(1, ratio))
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = boostBuffer
      source.playbackRate.value = 0.85 + amount * 0.5
      gain.gain.setValueAtTime(0.12 + amount * 0.1, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + boostBuffer.duration / source.playbackRate.value)
      source.connect(gain).connect(master)
      source.start()
    },
    setSurface(surface) {
      if (grassGain && context) {
        grassGain.gain.setTargetAtTime(surface === 'grass' ? 0.07 : 0, context.currentTime, 0.05)
      }
    },
    lap(value) {
      chirp(value >= 3 ? 660 : 520, value >= 3 ? 990 : 780, 0.2, 'triangle', 0.14)
    },
    timeout() {
      chirp(280, 110, 0.25, 'square', 0.12)
    },
    finish(place) {
      chirp(place === 1 ? 523 : 392, place === 1 ? 1047 : 523, 0.5, 'triangle', 0.16)
    },
    duck(value) {
      ducked = value
      updateMaster()
    },
    pause() {
      void context?.suspend()
    },
    resume() {
      void context?.resume()
    },
    setMuted(value) {
      muted = value
      updateMaster()
    },
    destroy() {
      engineSource?.stop()
      grassSource?.stop()
      engineSource = null
      grassSource = null
      engineBuffer = null
      boostBuffer = null
      buffersLoaded = false
      void context?.close()
      context = null
      master = null
      lowpass = null
      engineGain = null
      engineLowpass = null
      grassGain = null
    },
  }
}
