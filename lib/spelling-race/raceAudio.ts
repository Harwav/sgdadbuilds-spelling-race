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

export function createRaceAudio(host: AudioHost = typeof window === 'undefined' ? {} : window): RaceAudio {
  let context: AudioContextLike | null = null
  let master: GainNode | null = null
  let engine: OscillatorNode | null = null
  let engineGain: GainNode | null = null
  let grass: AudioBufferSourceNode | null = null
  let grassGain: GainNode | null = null
  let muted = false
  let ducked = false

  function updateMaster() {
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : ducked ? 0.2 : 1, context.currentTime, 0.03)
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
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + delay
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  function ensureEngine() {
    if (!context || !master || engine) return
    engine = context.createOscillator()
    engineGain = context.createGain()
    engine.type = 'sawtooth'
    engine.frequency.value = 85
    engineGain.gain.value = 0.045
    engine.connect(engineGain).connect(master)
    engine.start()

    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const samples = noise.getChannelData(0)
    samples.forEach((_, index) => { samples[index] = Math.random() * 2 - 1 })
    grass = context.createBufferSource()
    grassGain = context.createGain()
    grass.buffer = noise
    grass.loop = true
    grassGain.gain.value = 0
    grass.connect(grassGain).connect(master)
    grass.start()
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
        master.connect(context.destination)
        updateMaster()
      }
      if (context.state === 'suspended') await context.resume()
      if (created) chirp(440, 660, 0.06, 'sine', 0.06)
    },
    startRace() {
      ensureEngine()
      chirp(330, 330, 0.1, 'square', 0.1)
      chirp(440, 440, 0.1, 'square', 0.1, 0.4)
      chirp(660, 880, 0.18, 'square', 0.14, 0.8)
    },
    setEngine(speed) {
      if (!context || !engine || !engineGain) return
      const ratio = Math.max(0, Math.min(1, speed))
      engine.frequency.setTargetAtTime(75 + ratio * 175, context.currentTime, 0.04)
      engineGain.gain.setTargetAtTime(0.03 + ratio * 0.05, context.currentTime, 0.04)
    },
    boost(ratio) {
      const amount = Math.max(0, Math.min(1, ratio))
      chirp(220 + amount * 160, 620 + amount * 520, 0.16, 'sawtooth', 0.06 + amount * 0.1)
    },
    setSurface(surface) {
      if (grassGain && context) grassGain.gain.setTargetAtTime(surface === 'grass' ? 0.08 : 0, context.currentTime, 0.05)
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
      engine?.stop()
      grass?.stop()
      engine = null
      grass = null
      void context?.close()
      context = null
      master = null
      engineGain = null
      grassGain = null
    },
  }
}
