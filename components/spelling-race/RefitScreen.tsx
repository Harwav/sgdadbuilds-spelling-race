'use client'

import { useEffect, useRef, useState } from 'react'
import { evaluateSightWordAnswer } from '@/lib/spelling-race/transcriptMatcher'
import { refitStore, type RefitSnapshot } from '@/lib/spelling-race/refitStore'
import { createRecognitionPort, voiceGateForError, type RecognitionPort } from '@/lib/spelling-race/voiceCapability'

type RefitScreenProps = {
  onBack(): void
}

type MicState = 'idle' | 'listening' | 'success' | 'retry' | 'error'

const REFIT_ROUND_SIZE = 3
const MAX_SPEED_LEVELS = 5

export default function RefitScreen({ onBack }: RefitScreenProps) {
  const [snapshot, setSnapshot] = useState<RefitSnapshot>(refitStore.read)
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [micState, setMicState] = useState<MicState>('idle')
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recognitionRef = useRef<RecognitionPort | null>(null)
  const recognitionTokenRef = useRef(0)
  const micStateRef = useRef<MicState>('idle')
  const handledRef = useRef(false)

  useEffect(() => { micStateRef.current = micState }, [micState])

  // Subscribe to store changes
  useEffect(() => {
    return refitStore.subscribe(() => setSnapshot(refitStore.read()))
  }, [])

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  function pickWord(word: string) {
    setActiveWord(word)
    setMicState('idle')
    micStateRef.current = 'idle'
    setFeedback(`Tap the mic and say "${word}"`)
    setErrorMessage(null)
  }

  function startListening() {
    if (!activeWord) return
    const word = activeWord

    const port = recognitionRef.current ?? createRecognitionPort(window)
    if (!port) {
      setErrorMessage('Voice recognition is not available in this browser.')
      return
    }
    recognitionRef.current = port

    const token = recognitionTokenRef.current + 1
    recognitionTokenRef.current = token
    handledRef.current = false

    setMicState('listening')
    micStateRef.current = 'listening'
    setFeedback(`Listening for "${word}"…`)
    setErrorMessage(null)

    port.start(
      (candidates, isFinal) => {
        if (token !== recognitionTokenRef.current || handledRef.current) return

        const result = evaluateSightWordAnswer(word, candidates.map(({ transcript }) => transcript), isFinal)
        if (!result) return

        handledRef.current = true

        if (result.outcome === 'accepted') {
          setMicState('success')
          micStateRef.current = 'success'
          setFeedback(`Correct! You said "${result.detected}".`)

          refitStore.removeSkippedWord(word)

          const { roundCompleted, snapshot: updated } = refitStore.incrementProgress()
          if (roundCompleted) {
            const pct = Math.round(updated.speedModifier * 100)
            setFeedback(`⚡ Upgrade! +${pct}% speed & handling. Your kart is faster and more responsive!`)
          } else {
            const left = 3 - updated.refitProgress
            setFeedback(`Great! ${left} more word${left > 1 ? 's' : ''} for the next kart upgrade.`)
          }

          // Clear active word after short celebration
          setTimeout(() => {
            setActiveWord(null)
            setMicState('idle')
            micStateRef.current = 'idle'
          }, 1800)
        } else {
          setMicState('retry')
          micStateRef.current = 'retry'
          const detected = result.detected ?? 'something else'
          setFeedback(`I heard "${detected}". Try saying "${word}" again.`)
          setTimeout(() => {
            if (micStateRef.current === 'retry') {
              setMicState('idle')
              micStateRef.current = 'idle'
            }
          }, 2000)
        }
      },
      (code) => {
        if (token !== recognitionTokenRef.current) return
        const status = voiceGateForError(code)
        setMicState('error')
        micStateRef.current = 'error'
        setErrorMessage(status.message)
        setFeedback('')
      },
      () => {
        if (token !== recognitionTokenRef.current) return
        if (micStateRef.current === 'listening') {
          setMicState('idle')
          micStateRef.current = 'idle'
        }
      },
      () => {
        if (token !== recognitionTokenRef.current) return
        setMicState('listening')
        micStateRef.current = 'listening'
      },
    )
  }

  const { skippedWords, speedModifier, handlingModifier, refitCompletions, refitProgress } = snapshot
  const speedLevels = Math.min(refitCompletions, MAX_SPEED_LEVELS)

  return (
    <section className="mx-auto max-w-2xl rounded-xl border p-5 sm:p-7" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Refit Garage</p>
      <h2 className="mt-2 text-2xl font-bold">Upgrade Your Kart</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Practise words you skipped during races. Read {REFIT_ROUND_SIZE} correctly to earn a permanent speed boost.
      </p>

      {/* Speed level */}
      <div className="mt-4 rounded-xl border p-4" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Kart Speed Level</h3>
          <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
            +{Math.round(speedModifier * 100)}% base speed
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {Array.from({ length: MAX_SPEED_LEVELS }, (_, i) => (
            <div
              key={i}
              className="h-3 flex-1 rounded-full border"
              style={{
                background: i < speedLevels ? 'var(--brand-yellow)' : 'transparent',
                borderColor: i < speedLevels ? 'var(--brand-yellow)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>
        {speedLevels >= MAX_SPEED_LEVELS && (
          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--brand-yellow)' }}>Max speed reached! Well done!</p>
        )}
      </div>

      {/* Handling level */}
      <div className="mt-3 rounded-xl border p-4" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">Kart Handling Level</h3>
          <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
            +{Math.round(handlingModifier * 100)}% steering response
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {Array.from({ length: MAX_SPEED_LEVELS }, (_, i) => (
            <div
              key={i}
              className="h-3 flex-1 rounded-full border"
              style={{
                background: i < speedLevels ? 'var(--race-success)' : 'transparent',
                borderColor: i < speedLevels ? 'var(--race-success)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>
        {speedLevels >= MAX_SPEED_LEVELS && (
          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--race-success)' }}>Max handling reached! Precision steering.</p>
        )}
      </div>

      {/* Progress toward next boost */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span style={{ color: 'var(--text-secondary)' }}>Next boost:</span>
        {Array.from({ length: REFIT_ROUND_SIZE }, (_, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full border"
            style={{
              background: i < refitProgress ? 'var(--race-success)' : 'transparent',
              borderColor: i < refitProgress ? 'var(--race-success)' : 'var(--line-strong)',
            }}
          />
        ))}
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {REFIT_ROUND_SIZE - refitProgress} to go
        </span>
      </div>

      {/* Active word practice card */}
      {activeWord ? (
        <div
          className="mt-5 rounded-xl border p-5 text-center transition-colors"
          style={{
            background: 'var(--fill-ghost)',
            borderColor:
              micState === 'success' ? 'var(--race-success)' :
              micState === 'retry' ? 'var(--status-caution)' :
              'var(--line)',
          }}
        >
          <p className="text-5xl font-bold lowercase" style={{ color: 'var(--text-primary)' }}>{activeWord}</p>
          <p
            className="mt-3 text-sm font-semibold"
            style={{
              color:
                micState === 'success' ? 'var(--race-success)' :
                micState === 'retry' ? 'var(--status-caution)' :
                'var(--text-secondary)',
            }}
          >
            {feedback || `Tap the mic and say "${activeWord}"`}
          </p>
          <div className="mt-4">
            {micState === 'listening' ? (
              <div
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-base font-bold shadow-lg"
                style={{ background: 'var(--surface-1)', color: 'var(--grand-prix-kart-stripe)' }}
              >
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: 'var(--brand-yellow)' }} />
                Listening…
              </div>
            ) : micState === 'success' ? (
              <div
                className="inline-flex min-h-12 items-center rounded-full px-6 text-base font-bold"
                style={{ background: 'var(--race-success)', color: 'var(--brand-navy)' }}
              >
                ✓ Correct!
              </div>
            ) : (
              <button
                type="button"
                onClick={startListening}
                className="min-h-12 rounded-full px-7 text-base font-bold shadow-lg transition-transform active:scale-95"
                style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}
              >
                🎤 Tap mic, then say it
              </button>
            )}
          </div>
          {micState !== 'success' && (
            <button
              type="button"
              onClick={() => {
                setActiveWord(null)
                setMicState('idle')
                micStateRef.current = 'idle'
                setErrorMessage(null)
              }}
              className="mt-3 text-xs font-semibold"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Pick another word
            </button>
          )}
        </div>
      ) : (
        /* Word list */
        <div className="mt-5">
          <h3 className="font-bold text-sm">Words to practise ({skippedWords.length})</h3>
          {skippedWords.length === 0 ? (
            <div className="mt-3 rounded-xl border p-8 text-center" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
              <p className="text-4xl" aria-hidden="true">🏎️</p>
              <p className="mt-3 font-bold">No words to practise yet!</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Words you skip during races will appear here so you can practise them and earn speed boosts.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...skippedWords].sort().map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => pickWord(word)}
                  className="rounded-full border px-4 py-2 text-sm font-semibold lowercase transition-all hover:scale-105"
                  style={{ borderColor: 'var(--line-strong)', color: 'var(--text-primary)', background: 'var(--fill-ghost)' }}
                >
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="mt-4 rounded-lg border p-3 text-sm" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--status-caution)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null)
              setMicState('idle')
              micStateRef.current = 'idle'
            }}
            className="mt-2 text-xs font-bold"
            style={{ color: 'var(--brand-yellow)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Back button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-full border px-6 font-semibold"
          style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}
        >
          ← Back to Garage
        </button>
      </div>
    </section>
  )
}
