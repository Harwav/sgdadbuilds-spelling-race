'use client'

import { useEffect, useRef, useState } from 'react'
import { evaluateSightWordAnswer } from '@/lib/spelling-race/transcriptMatcher'
import { createTiltPort, type TiltPort } from '@/lib/spelling-race/tiltController'
import type { SteeringMode, VoiceGateState } from '@/lib/spelling-race/types'
import { createRecognitionPort, inspectVoiceEnvironment, voiceGateForError, type RecognitionPort } from '@/lib/spelling-race/voiceCapability'

type RaceReadinessGateProps = {
  onReady(mode: SteeringMode): void
  onBack(): void
}

type VoiceStatus = { state: VoiceGateState; message: string }

export default function RaceReadinessGate({ onReady, onBack }: RaceReadinessGateProps) {
  const [landscape, setLandscape] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>({ state: 'permission-needed', message: 'Say “go” so we know the microphone can hear you.' })
  const [voiceReady, setVoiceReady] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [steeringMode, setSteeringMode] = useState<SteeringMode | null>(null)
  const [tiltPermission, setTiltPermission] = useState<'idle' | 'granted'>('idle')
  const [tiltMessage, setTiltMessage] = useState('Enable tilt, then hold the iPad comfortably and calibrate.')
  const recognitionRef = useRef<RecognitionPort | null>(null)
  const tiltRef = useRef<TiltPort | null>(null)

  useEffect(() => {
    const updateOrientation = () => setLandscape(window.innerWidth >= window.innerHeight)
    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
  }, [])

  useEffect(() => {
    tiltRef.current = createTiltPort(window)
    return () => {
      recognitionRef.current?.abort()
      tiltRef.current?.destroy()
    }
  }, [])

  async function checkVoice() {
    setVoiceReady(false)
    setVoiceListening(true)
    const injectedVoice = process.env.NODE_ENV !== 'production' ? window.__spellingRaceVoice : undefined
    const available = inspectVoiceEnvironment({
      secureContext: window.isSecureContext,
      hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      hasRecognitionConstructor: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition ?? injectedVoice),
    })
    if (available.state !== 'ready') {
      setVoiceStatus(available)
      setVoiceListening(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      const port = createRecognitionPort(window)
      if (!port) {
        setVoiceStatus(available)
        setVoiceListening(false)
        return
      }
      recognitionRef.current = port
      port.start(
        (candidates, isFinal) => {
          const result = evaluateSightWordAnswer('go', candidates.map(({ transcript }) => transcript), isFinal)
          if (!result) return
          if (result.outcome === 'accepted') {
            setVoiceReady(true)
            setVoiceStatus({ state: 'ready', message: 'Voice is ready.' })
          } else {
            setVoiceStatus({ state: 'permission-needed', message: 'We heard something else. Tap Check voice and say “go” once more.' })
          }
        },
        (code) => setVoiceStatus(voiceGateForError(code)),
        () => setVoiceListening(false),
      )
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      setVoiceStatus(voiceGateForError(denied ? 'not-allowed' : 'network'))
      setVoiceListening(false)
    }
  }

  async function enableTilt() {
    const mode = await tiltRef.current?.requestPermission()
    if (mode === 'granted') {
      setTiltPermission('granted')
      setTiltMessage('Hold the iPad in your racing position, then calibrate steering.')
      return
    }
    chooseTouchSteering()
  }

  function calibrateTilt() {
    tiltRef.current?.calibrate()
    setSteeringMode('tilt')
    setTiltMessage('Tilt steering is ready.')
  }

  function chooseTouchSteering() {
    setSteeringMode('touch')
    setTiltMessage('Touch steering is ready. Use the left and right buttons during the race.')
  }

  if (!landscape) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border p-7 text-center" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
        <p className="text-5xl" aria-hidden="true">↻</p>
        <h2 className="mt-3 text-2xl font-bold">Turn the iPad sideways</h2>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Tiny Grand Prix needs a landscape track before the safety checks can begin.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl rounded-xl border p-5 sm:p-7" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Parent ready check</p>
      <h2 className="mt-2 text-2xl font-bold">Voice and steering</h2>
      <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        Your browser may process speech online to recognise it. This app does not save audio or transcripts.
      </p>

      <div className="mt-5 rounded-xl border p-4" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
        <h3 className="font-bold">1. Check voice</h3>
        <p aria-live="polite" className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{voiceListening ? 'Listening for “go”…' : voiceStatus.message}</p>
        {!voiceReady && voiceStatus.state !== 'unsupported' && (
          <button type="button" onClick={checkVoice} disabled={voiceListening} className="mt-3 min-h-11 rounded-full px-5 text-sm font-bold disabled:opacity-50" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>
            {voiceListening ? 'Listening…' : 'Check voice'}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl border p-4" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
        <h3 className="font-bold">2. Check steering</h3>
        <p aria-live="polite" className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{tiltMessage}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {tiltPermission === 'idle' && steeringMode === null && <button type="button" onClick={enableTilt} className="min-h-11 rounded-full px-5 text-sm font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Enable tilt</button>}
          {tiltPermission === 'granted' && steeringMode === null && <button type="button" onClick={calibrateTilt} className="min-h-11 rounded-full px-5 text-sm font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Calibrate steering</button>}
          {steeringMode !== 'touch' && <button type="button" onClick={chooseTouchSteering} className="min-h-11 rounded-full border px-5 text-sm font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>Use touch steering</button>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => steeringMode && onReady(steeringMode)} disabled={!voiceReady || steeringMode === null} className="min-h-12 rounded-full px-6 font-bold disabled:opacity-40" style={{ background: 'var(--race-success)', color: 'var(--brand-navy)' }}>
          Line up on the grid
        </button>
        <button type="button" onClick={onBack} className="min-h-12 rounded-full border px-5 font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>Back</button>
      </div>
    </section>
  )
}
