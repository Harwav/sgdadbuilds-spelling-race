'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  createRecognitionPort,
  inspectVoiceEnvironment,
  voiceGateForError,
  type RecognitionPort,
} from '@/lib/spelling-race/voiceCapability'
import type { VoiceGateState } from '@/lib/spelling-race/types'

type VoiceStatus = {
  state: VoiceGateState
  message: string
}

function inspectCurrentBrowser(): VoiceStatus {
  return inspectVoiceEnvironment({
    secureContext: window.isSecureContext,
    hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    hasRecognitionConstructor: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
  })
}

function microphoneErrorCode(error: unknown): string {
  if (
    (error instanceof DOMException && error.name === 'NotAllowedError') ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError')
  ) {
    return 'not-allowed'
  }
  return 'network'
}

export default function VoicePocClient() {
  const mounted = useSyncExternalStore(emptySubscribe, browserSnapshot, serverSnapshot)
  const [statusOverride, setStatus] = useState<VoiceStatus | null>(null)
  const [listening, setListening] = useState(false)
  const [events, setEvents] = useState<string[]>([])
  const [tiltEnabled, setTiltEnabled] = useState(false)
  const portRef = useRef<RecognitionPort | null>(null)
  const tiltListenerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null)

  const record = (event: string) => setEvents((current) => [...current.slice(-7), event])

  useEffect(() => {
    return () => {
      portRef.current?.abort()
      portRef.current = null
      if (tiltListenerRef.current) window.removeEventListener('deviceorientation', tiltListenerRef.current)
    }
  }, [])

  const status = statusOverride ?? (mounted
    ? inspectCurrentBrowser()
    : { state: 'permission-needed' as const, message: 'Checking voice support…' })

  async function checkVoice() {
    setListening(true)
    record(`voice: secure=${window.isSecureContext} media=${Boolean(navigator.mediaDevices?.getUserMedia)} recognition=${Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)}`)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      record('voice: microphone permission granted')

      const port = createRecognitionPort(window)
      if (!port) {
        setStatus(inspectCurrentBrowser())
        setListening(false)
        return
      }

      portRef.current = port
      port.start(
        (candidates, isFinal) => {
          record(`voice: ${isFinal ? 'final' : 'interim'} result, ${candidates.length} alternative${candidates.length === 1 ? '' : 's'}`)
          if (isFinal) setStatus({ state: 'ready', message: 'Voice is ready.' })
        },
        (code) => { record(`voice: error ${code}`); setStatus(voiceGateForError(code)) },
        () => { record('voice: recognition ended'); setListening(false) },
        () => record('voice: recognition started'),
      )
    } catch (error) {
      record(`voice: microphone error ${microphoneErrorCode(error)}`)
      setStatus(voiceGateForError(microphoneErrorCode(error)))
      setListening(false)
    }
  }

  async function checkTilt() {
    const constructor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> } | undefined
    if (!constructor) {
      record('tilt: DeviceOrientationEvent unavailable')
      return
    }
    try {
      const permission = constructor.requestPermission ? await constructor.requestPermission() : 'not-required'
      record(`tilt: permission ${permission}`)
      if (permission === 'denied') return
      if (tiltListenerRef.current) window.removeEventListener('deviceorientation', tiltListenerRef.current)
      const listener = (event: DeviceOrientationEvent) => {
        record(`tilt: event beta=${event.beta ?? 'null'} gamma=${event.gamma ?? 'null'} angle=${window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0}`)
        window.removeEventListener('deviceorientation', listener)
        tiltListenerRef.current = null
      }
      tiltListenerRef.current = listener
      window.addEventListener('deviceorientation', listener)
      setTiltEnabled(true)
    } catch {
      record('tilt: permission request threw')
    }
  }

  async function checkContinuousVoice() {
    setListening(true)
    record('voice: continuous check requested')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      const port = createRecognitionPort(window)
      if (!port) throw new Error('recognition unavailable')
      let completedTurns = 0
      const listen = () => {
        port.start(
          (_candidates, isFinal) => {
            if (!isFinal) return
            completedTurns += 1
            record(`voice: continuous result ${completedTurns}/2`)
          },
          (code) => { record(`voice: continuous error ${code}`); setListening(false) },
          () => {
            record(`voice: continuous end ${completedTurns}/2`)
            if (completedTurns < 2) {
              record('voice: continuous restart requested')
              window.setTimeout(listen, 0)
            } else {
              record('voice: continuous check complete')
              setListening(false)
            }
          },
          () => record(`voice: continuous start ${completedTurns + 1}/2`),
        )
      }
      listen()
    } catch (error) {
      record(`voice: continuous microphone error ${microphoneErrorCode(error)}`)
      setListening(false)
    }
  }

  const canCheck = status.state === 'ready' || status.state === 'permission-needed'

  return (
    <main className="ui-font min-h-full flex items-center justify-center p-4" style={{ background: 'var(--brand-navy)' }}>
      <section
        className="w-full max-w-xl rounded-xl border p-6 shadow-lg"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text-primary)' }}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>
          Spelling Race
        </p>
        <h1 className="mt-2 text-2xl font-bold">Voice check</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Your browser may process speech online to recognise it. This app does not save audio or transcripts.
        </p>

        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--line)', background: 'var(--fill-ghost)', color: 'var(--text-secondary)' }}
        >
          {listening ? 'Listening…' : status.message}
        </div>

        {canCheck && (
          <button
            type="button"
            onClick={checkVoice}
            disabled={listening}
            className="mt-6 min-h-11 rounded-full px-5 text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}
          >
            Check voice
          </button>
        )}
        {canCheck && <button type="button" onClick={checkContinuousVoice} disabled={listening} className="ml-3 mt-6 min-h-11 rounded-full border px-5 text-sm font-bold disabled:opacity-50" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-primary)' }}>Check continuous voice</button>}
        <button type="button" onClick={checkTilt} disabled={tiltEnabled} className="ml-3 mt-6 min-h-11 rounded-full border px-5 text-sm font-bold disabled:opacity-50" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-primary)' }}>Check tilt</button>
        <div className="mt-5 rounded-lg border p-4 text-xs leading-5" style={{ borderColor: 'var(--line)', background: 'var(--fill-ghost)', color: 'var(--text-secondary)' }}>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>iPad diagnostic, not saved</p>
          <p className="mt-1">Tap each check directly. For continuous voice, say `go` twice; then tilt the iPad left once. Send this list back if either check fails.</p>
          <ol className="mt-2 list-decimal pl-5">{events.length ? events.map((event) => <li key={event}>{event}</li>) : <li>Waiting for a direct check.</li>}</ol>
        </div>
      </section>
    </main>
  )
}

function emptySubscribe() {
  return () => undefined
}

function browserSnapshot() {
  return true
}

function serverSnapshot() {
  return false
}
