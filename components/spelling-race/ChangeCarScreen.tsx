'use client'

import { useEffect, useRef, useState } from 'react'
import { CAR_CHALLENGE_WORD_COUNT } from '@/lib/spelling-race/carWords'
import { carStore, CAR_IDS, CAR_NAMES, type CarId, type CarStoreSnapshot } from '@/lib/spelling-race/carStore'
import { evaluateSightWordAnswer } from '@/lib/spelling-race/transcriptMatcher'
import { createRecognitionPort, voiceGateForError, type RecognitionPort } from '@/lib/spelling-race/voiceCapability'

type ChangeCarScreenProps = {
  onBack(): void
}

type MicState = 'idle' | 'listening' | 'success' | 'retry' | 'error'

export default function ChangeCarScreen({ onBack }: ChangeCarScreenProps) {
  const [snapshot, setSnapshot] = useState<CarStoreSnapshot>(carStore.read)
  const [challengeWords, setChallengeWords] = useState<readonly string[]>([])
  const [wordIndex, setWordIndex] = useState(0)
  const [micState, setMicState] = useState<MicState>('idle')
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recognitionRef = useRef<RecognitionPort | null>(null)
  const recognitionTokenRef = useRef(0)
  const micStateRef = useRef<MicState>('idle')
  const handledRef = useRef(false)

  useEffect(() => { micStateRef.current = micState }, [micState])

  useEffect(() => {
    return carStore.subscribe(() => setSnapshot(carStore.read()))
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const currentWord = challengeWords[wordIndex] ?? null

  function startChallenge(carId: CarId) {
    carStore.startUnlock(carId)
    const words = carStore.pickChallengeWords(CAR_CHALLENGE_WORD_COUNT)
    setChallengeWords(words)
    setWordIndex(0)
    setMicState('idle')
    micStateRef.current = 'idle'
    setFeedback(`Say "${words[0]}" to unlock ${CAR_NAMES[carId]}`)
    setErrorMessage(null)
    recognitionTokenRef.current += 1
  }

  function cancelChallenge() {
    carStore.cancelUnlock()
    setChallengeWords([])
    setWordIndex(0)
    setMicState('idle')
    micStateRef.current = 'idle'
    setFeedback('')
    setErrorMessage(null)
  }

  function startListening() {
    if (!currentWord) return

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
    setFeedback(`Listening for "${currentWord}"…`)
    setErrorMessage(null)

    port.start(
      (candidates, isFinal) => {
        if (token !== recognitionTokenRef.current || handledRef.current) return

        const result = evaluateSightWordAnswer(currentWord, candidates, isFinal)
        if (!result) return

        handledRef.current = true

        if (result.outcome === 'accepted') {
          setMicState('success')
          micStateRef.current = 'success'

          const { completed, snapshot: updated } = carStore.recordWord()

          if (completed) {
            carStore.markWordsUsed(challengeWords)
            setFeedback(`🎉 ${CAR_NAMES[snapshot.activeCar!]} unlocked! Equipped and ready to race.`)
            setChallengeWords([])
            setWordIndex(0)
          } else {
            const nextIndex = wordIndex + 1
            setWordIndex(nextIndex)
            const nextWord = challengeWords[nextIndex]
            setFeedback(`✓ Correct! Next: "${nextWord}" (${nextIndex + 1}/${CAR_CHALLENGE_WORD_COUNT})`)
            setMicState('idle')
            micStateRef.current = 'idle'
          }
        } else {
          setMicState('retry')
          micStateRef.current = 'retry'
          const detected = result.detected ?? 'something else'
          setFeedback(`I heard "${detected}". Try saying "${currentWord}" again.`)
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

  function handleEquip(carId: CarId) {
    if (snapshot.equippedCar === carId) {
      carStore.equipCar(null) // unequip, back to default kart
    } else {
      carStore.equipCar(carId)
    }
  }

  const isChallenging = snapshot.activeCar !== null

  return (
    <section className="mx-auto max-w-2xl rounded-xl border p-5 sm:p-7" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      {/* Header */}
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Change Car</p>
      <h2 className="mt-2 text-2xl font-bold">Collect New Cars</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Read {CAR_CHALLENGE_WORD_COUNT} challenge words to unlock a new car. Your car appears in the garage and on the track.
      </p>

      {/* Active challenge card */}
      {isChallenging && currentWord && (
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
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Unlocking {CAR_NAMES[snapshot.activeCar!]}
          </p>
          <p className="mt-2 text-5xl font-bold lowercase" style={{ color: 'var(--text-primary)' }}>{currentWord}</p>

          {/* Progress dots */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {Array.from({ length: CAR_CHALLENGE_WORD_COUNT }, (_, i) => (
              <div
                key={i}
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  background: i < wordIndex ? 'var(--race-success)' : 'transparent',
                  borderColor: i < wordIndex ? 'var(--race-success)' : 'var(--line-strong)',
                }}
              />
            ))}
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {wordIndex}/{CAR_CHALLENGE_WORD_COUNT}
            </span>
          </div>

          <p
            className="mt-3 text-sm font-semibold"
            style={{
              color:
                micState === 'success' ? 'var(--race-success)' :
                micState === 'retry' ? 'var(--status-caution)' :
                'var(--text-secondary)',
            }}
          >
            {feedback || `Tap the mic and say "${currentWord}"`}
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

          <button
            type="button"
            onClick={cancelChallenge}
            className="mt-4 text-xs font-semibold"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Cancel challenge
          </button>
        </div>
      )}

      {/* Car grid */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {CAR_IDS.map((carId) => {
          const unlocked = snapshot.unlockedCars.includes(carId)
          const equipped = snapshot.equippedCar === carId
          const isActiveChallenge = snapshot.activeCar === carId

          return (
            <div
              key={carId}
              className="rounded-xl border p-4"
              style={{
                background: equipped ? 'var(--fill-ghost)' : 'var(--surface-1)',
                borderColor: equipped ? 'var(--brand-yellow)' : isActiveChallenge ? 'var(--race-success)' : 'var(--line-strong)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">{CAR_NAMES[carId]}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {unlocked ? (equipped ? '⚡ Equipped' : 'Tap to equip') : `${CAR_CHALLENGE_WORD_COUNT} words to unlock`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => handleEquip(carId)}
                      className="min-h-9 rounded-full border px-4 text-xs font-bold transition-all active:scale-95"
                      style={{
                        background: equipped ? 'var(--brand-yellow)' : 'transparent',
                        borderColor: 'var(--brand-yellow)',
                        color: equipped ? 'var(--brand-navy)' : 'var(--brand-yellow)',
                      }}
                    >
                      {equipped ? 'Equipped ✓' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startChallenge(carId)}
                      disabled={isChallenging}
                      className="min-h-9 rounded-full border px-4 text-xs font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        background: isActiveChallenge ? 'var(--race-success)' : 'transparent',
                        borderColor: isActiveChallenge ? 'var(--race-success)' : 'var(--line-strong)',
                        color: isActiveChallenge ? 'var(--brand-navy)' : 'var(--text-secondary)',
                      }}
                    >
                      {isActiveChallenge ? 'Unlocking…' : '🔒 Unlock'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

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
          onClick={() => {
            if (isChallenging) cancelChallenge()
            onBack()
          }}
          className="min-h-12 rounded-full border px-6 font-semibold"
          style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}
        >
          ← Back to Garage
        </button>
      </div>
    </section>
  )
}
