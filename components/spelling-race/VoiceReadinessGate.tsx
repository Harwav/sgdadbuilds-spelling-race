'use client'

import { useEffect, useRef, useState } from 'react'
import { createRecognitionPort, inspectVoiceEnvironment, voiceGateForError, type RecognitionPort } from '@/lib/spelling-race/voiceCapability'
import type { VoiceGateState } from '@/lib/spelling-race/types'

export type VoiceReadinessGateProps = { onReady: () => void; onBack: () => void }
type VoiceStatus = { state: VoiceGateState; message: string }

function browserStatus(): VoiceStatus {
  const testVoice = process.env.NODE_ENV !== 'production' ? window.__spellingRaceVoice : undefined
  return inspectVoiceEnvironment({ secureContext: window.isSecureContext, hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia), hasRecognitionConstructor: Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition ?? testVoice) })
}

export default function VoiceReadinessGate({ onReady, onBack }: VoiceReadinessGateProps) {
  const [status, setStatus] = useState<VoiceStatus>({ state: 'permission-needed', message: 'Tap Check voice to confirm browser support.' })
  const [listening, setListening] = useState(false)
  const [checked, setChecked] = useState(false)
  const portRef = useRef<RecognitionPort | null>(null)

  useEffect(() => {
    return () => portRef.current?.abort()
  }, [])

  async function checkVoice() {
    setListening(true)
    setChecked(false)
    const available = browserStatus()
    if (available.state !== 'ready') {
      setStatus(available)
      setListening(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      const port = createRecognitionPort(window)
      if (!port) {
        setStatus(browserStatus())
        setListening(false)
        return
      }
      portRef.current = port
      port.start(
        (_candidates, isFinal) => {
          if (!isFinal) return
          setStatus({ state: 'ready', message: 'Voice is ready.' })
          setChecked(true)
        },
        (code) => setStatus(voiceGateForError(code)),
        () => setListening(false),
      )
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError'
      setStatus(voiceGateForError(denied ? 'not-allowed' : 'network'))
      setListening(false)
    }
  }

  return (
    <section className="ui-font mx-auto w-full max-w-xl rounded-xl border p-6" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Parent check</p>
      <h1 className="mt-2 text-2xl font-bold">Make sure voice is ready</h1>
      <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>Your browser may process speech online to recognise it. This app does not save audio or transcripts.</p>
      <p aria-live="polite" className="mt-5 rounded-lg border p-4 text-sm" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)', color: 'var(--text-secondary)' }}>{listening ? 'Listening…' : status.message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {!checked && status.state !== 'unsupported' && <button type="button" onClick={checkVoice} disabled={listening} className="min-h-11 rounded-full px-5 text-sm font-bold disabled:opacity-50" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>{listening ? 'Listening…' : 'Check voice'}</button>}
        {checked && <button type="button" onClick={onReady} className="min-h-11 rounded-full px-5 text-sm font-bold" style={{ background: 'var(--race-success)', color: 'var(--brand-navy)' }}>Start race</button>}
        <button type="button" onClick={onBack} className="min-h-11 rounded-full border px-4 text-sm font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>Back to list</button>
      </div>
    </section>
  )
}
