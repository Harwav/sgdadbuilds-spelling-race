'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { createRaceAudio, type RaceAudio } from '@/lib/spelling-race/raceAudio'
import { applyBoost, createRace, stepRace, TRACK_LENGTH, type RaceState } from '@/lib/spelling-race/raceSimulation'
import { refitStore } from '@/lib/spelling-race/refitStore'
import { createBrowserRetryPromptPort, type RetryPromptPort } from '@/lib/spelling-race/retryVoicePrompt'
import { createTiltPort, type TiltPort } from '@/lib/spelling-race/tiltController'
import { evaluateSightWordAnswer, type SightWordAttemptMode } from '@/lib/spelling-race/transcriptMatcher'
import type { CarId } from '@/lib/spelling-race/carStore'
import type { Difficulty, KartColour, RaceRecap, SteeringMode } from '@/lib/spelling-race/types'
import { createRecognitionPort, voiceGateForError, type RecognitionPort } from '@/lib/spelling-race/voiceCapability'
import { createVoiceDiagnosticRecorder } from '@/lib/spelling-race/voiceDiagnostics'
import { decideVoiceError, decideVoiceEvidence, type VoiceTurnDecision } from '@/lib/spelling-race/voiceTurnPolicy'
import { bankForDifficulty } from '@/lib/spelling-race/wordBanks'
import { isCompleteWorldAssetBundle, type LoadedWorldAssets } from '@/lib/spelling-race/world/assets'
import type { RouteCard } from '@/lib/spelling-race/world/types'
import {
  acceptActiveWord,
  assistActiveWord,
  createWordDirector,
  deferActiveWord,
  showNextWord,
  skipActiveWord,
  timeoutActiveWord,
  WORD_WINDOW_MS,
  type WordDirectorState,
} from '@/lib/spelling-race/wordDirector'
import RaceHud from './RaceHud'

const TinyGrandPrixScene = dynamic(() => import('./TinyGrandPrixScene'), {
  ssr: false,
  loading: () => <div className="min-h-[360px] animate-pulse rounded-xl border" style={{ background: 'var(--grand-prix-sky)', borderColor: 'var(--line)' }} />,
})

export type RaceScreenProps = {
  difficulty: Difficulty
  kartColour: KartColour
  steeringMode: SteeringMode
  route: RouteCard
  assets: LoadedWorldAssets
  speedModifier?: number
  handlingModifier?: number
  equippedCarId?: CarId | null
  onFinished(result: RaceRecap): void
  onExit(): void
}

type RaceStage = 'grid' | 'countdown' | 'racing' | 'finished'
type MicrophoneState = 'ready' | 'listening' | 'interrupted'
type RecognitionCloseReason = 'word-resolved' | 'stopped' | 'error'
type SpeechReceipt =
  | { kind: 'exact' }
  | { kind: 'phonetic' }
  | null
type PendingVoiceAction = Extract<VoiceTurnDecision, { kind: 'prompt-retry' | 'defer' }> & { word: string }

const FIXED_STEP_SECONDS = 1 / 60
const DEFAULT_SEED = 2_026_073
const DEFAULT_COUNTDOWN_MS = 2_400

export default function RaceScreen({ difficulty, kartColour, steeringMode, route, assets, speedModifier = 0, handlingModifier = 0, equippedCarId = null, onFinished, onExit }: RaceScreenProps) {
  const initialRace = useMemo(() => createRace({ playerColour: kartColour, seed: DEFAULT_SEED }), [kartColour])
  const initialDirector = useMemo(() => createWordDirector(bankForDifficulty(difficulty)), [difficulty])
  const [stage, setStage] = useState<RaceStage>('grid')
  const [countdownLight, setCountdownLight] = useState(3)
  const [race, setRace] = useState<RaceState>(initialRace)
  const [director, setDirector] = useState<WordDirectorState>(initialDirector)
  const [wordTurboRatio, setWordTurboRatio] = useState(0)
  const [microphone, setMicrophone] = useState<MicrophoneState>('ready')
  const [feedback, setFeedback] = useState('Read each word before its turbo bar runs out.')
  const [manualPaused, setManualPaused] = useState(false)
  const [speechIssue, setSpeechIssue] = useState<string | null>(null)
  const [landscape, setLandscape] = useState(true)
  const [needsRecalibration, setNeedsRecalibration] = useState(false)
  const [webglIssue, setWebglIssue] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [muted, setMuted] = useState(false)
  const [listenAttempt, setListenAttempt] = useState(0)
  const [speechReceipt, setSpeechReceipt] = useState<SpeechReceipt>(null)
  const [celebrating, setCelebrating] = useState(false)
  const [voiceTrace, setVoiceTrace] = useState<string[]>([])
  const [handsFreeListening, setHandsFreeListening] = useState(false)

  const raceRef = useRef(initialRace)
  const directorRef = useRef(initialDirector)
  const stageRef = useRef<RaceStage>('grid')
  const steeringRef = useRef(0)
  const wordClockMsRef = useRef(0)
  const wordArmedRef = useRef(false)
  const recognitionRef = useRef<RecognitionPort | null>(null)
  const recognitionTokenRef = useRef(0)
  const audioRef = useRef<RaceAudio | null>(null)
  const tiltRef = useRef<TiltPort | null>(null)
  const timeScaleRef = useRef(1)
  const countdownMsRef = useRef(DEFAULT_COUNTDOWN_MS)
  const finishedRef = useRef(false)
  const lastLapRef = useRef(1)
  const frozenRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  const finishTimerRef = useRef<number | null>(null)
  const celebrationTimerRef = useRef<number | null>(null)
  const handsFreeListeningRef = useRef(false)
  const recognitionOpenRef = useRef(false)
  const recognitionCloseReasonRef = useRef<RecognitionCloseReason | null>(null)
  const restartAfterEndRef = useRef(false)
  const handledVoiceSegmentsRef = useRef(new Set<number>())
  const voiceAttemptModeRef = useRef<SightWordAttemptMode>('isolated')
  const voiceAttemptWordRef = useRef<string | null>(null)
  const pendingVoiceActionRef = useRef<PendingVoiceAction | null>(null)
  const retryPromptRef = useRef<RetryPromptPort | null>(null)
  const retryPromptGenerationRef = useRef(0)
  if (retryPromptRef.current === null) retryPromptRef.current = createBrowserRetryPromptPort()

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const equippedCarModel = useMemo(
    () => (equippedCarId ? (assets.models.get(equippedCarId) ?? null) : null),
    [equippedCarId, assets],
  )
  const voiceDebug = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('voice-debug'),
    [],
  )
  const voiceDiagnostics = useMemo(
    () => createVoiceDiagnosticRecorder(voiceDebug, (payload) => track('spelling_voice_debug', { ...payload })),
    [voiceDebug],
  )
  const recordVoiceTrace = useCallback((event: string) => {
    if (!voiceDebug) return
    setVoiceTrace((current) => [...current.slice(-11), event])
  }, [voiceDebug])
  const frozen = manualPaused || Boolean(speechIssue) || !landscape || needsRecalibration || webglIssue || hidden
  const lap = Math.min(3, Math.floor(race.player.progress / TRACK_LENGTH) + 1)

  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  useEffect(() => {
    frozenRef.current = frozen
  }, [frozen])

  useEffect(() => {
    audioRef.current = createRaceAudio()
    return () => {
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current)
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      recognitionTokenRef.current += 1
      wordArmedRef.current = false
      retryPromptGenerationRef.current += 1
      retryPromptRef.current?.cancel()
      recognitionRef.current?.abort()
      recognitionRef.current = null
      audioRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    const readOrientationAngle = () => window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0
    let previousOrientationAngle = readOrientationAngle()
    const updateOrientation = () => {
      const nextLandscape = window.innerWidth >= window.innerHeight
      setLandscape((wasLandscape) => {
        if (wasLandscape && !nextLandscape && stageRef.current === 'racing' && steeringMode === 'tilt') {
          setNeedsRecalibration(true)
        }
        return nextLandscape
      })
    }
    const handleOrientationChange = () => {
      const nextOrientationAngle = readOrientationAngle()
      if (
        nextOrientationAngle !== previousOrientationAngle
        && stageRef.current === 'racing'
        && steeringMode === 'tilt'
      ) {
        setNeedsRecalibration(true)
      }
      previousOrientationAngle = nextOrientationAngle
      updateOrientation()
    }
    const updateVisibility = () => {
      const nextHidden = document.visibilityState !== 'visible'
      if (nextHidden) {
        handsFreeListeningRef.current = false
        setHandsFreeListening(false)
      }
      setHidden(nextHidden)
    }
    updateOrientation()
    updateVisibility()
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', handleOrientationChange)
    window.screen.orientation?.addEventListener('change', handleOrientationChange)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.screen.orientation?.removeEventListener('change', handleOrientationChange)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [steeringMode])

  useEffect(() => {
    if (steeringMode !== 'tilt') {
      steeringRef.current = 0
      tiltRef.current = null
      return
    }
    const port = createTiltPort(window)
    tiltRef.current = port
    const unsubscribe = port.subscribe((value) => { steeringRef.current = value })
    return () => {
      unsubscribe()
      port.destroy()
    }
  }, [steeringMode])

  const publishDirector = useCallback((next: WordDirectorState) => {
    directorRef.current = next
    setDirector(next)
    setWordTurboRatio(next.activeWord === null || next.helpAvailable ? 0 : 1)
  }, [])

  const cancelRetryPrompt = useCallback(() => {
    retryPromptGenerationRef.current += 1
    retryPromptRef.current?.cancel()
  }, [])

  const resetVoiceAttempt = useCallback(() => {
    voiceAttemptWordRef.current = null
    voiceAttemptModeRef.current = 'isolated'
    pendingVoiceActionRef.current = null
    cancelRetryPrompt()
  }, [cancelRetryPrompt])

  const stopRecognition = useCallback((nextMicrophone: MicrophoneState = 'ready') => {
    wordArmedRef.current = false
    restartAfterEndRef.current = false
    resetVoiceAttempt()
    setSpeechReceipt(null)
    if (recognitionOpenRef.current && recognitionCloseReasonRef.current !== 'stopped') {
      recognitionCloseReasonRef.current = 'stopped'
      recognitionRef.current?.abort()
    }
    audioRef.current?.duck(false)
    setMicrophone(nextMicrophone)
  }, [resetVoiceAttempt])

  const interruptSpeech = useCallback((code: string) => {
    wordArmedRef.current = false
    restartAfterEndRef.current = false
    resetVoiceAttempt()
    setSpeechReceipt(null)
    audioRef.current?.duck(true)
    audioRef.current?.pause()
    const status = voiceGateForError(code)
    setMicrophone('interrupted')
    setSpeechIssue(status.message)
  }, [resetVoiceAttempt])

  const endRecognitionTurn = useCallback(() => {
    wordArmedRef.current = false
    resetVoiceAttempt()
    recognitionCloseReasonRef.current = 'word-resolved'
    restartAfterEndRef.current = handsFreeListeningRef.current
    audioRef.current?.duck(false)
    setMicrophone('ready')
    if (recognitionOpenRef.current) recognitionRef.current?.stop()
  }, [resetVoiceAttempt])

  const handleCandidates = useCallback((candidates: readonly string[], isFinal = true): 'accepted' | 'unresolved' | null => {
    const current = directorRef.current
    if (!current.activeWord) return null
    const result = evaluateSightWordAnswer(current.activeWord, candidates, isFinal, voiceAttemptModeRef.current)
    if (!result) return null
    wordArmedRef.current = false
    audioRef.current?.duck(false)
    setMicrophone('ready')

    if (result.outcome === 'accepted') {
      setSpeechReceipt(result.match === 'exact' ? { kind: 'exact' } : { kind: 'phonetic' })
      const accepted = acceptActiveWord(current, wordClockMsRef.current)
      publishDirector(accepted.state)
      resetVoiceAttempt()
      raceRef.current = applyBoost(raceRef.current, accepted.boostRatio)
      setRace(raceRef.current)
      audioRef.current?.boost(accepted.boostRatio)
      setCelebrating(true)
      setFeedback(accepted.boostRatio > 0.65 ? 'Correct! Big boost!' : accepted.boostRatio > 0.3 ? 'Correct! Turbo!' : 'Correct! Nice save!')
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = window.setTimeout(() => setCelebrating(false), 650)
      return 'accepted'
    }

    setSpeechReceipt(null)
    return 'unresolved'
  }, [publishDirector, resetVoiceAttempt])

  const startRecognition = useCallback((fromChildGesture = false) => {
    const activeWord = directorRef.current.activeWord
    recordVoiceTrace(`tap/start: gesture=${fromChildGesture} stage=${stageRef.current} frozen=${frozenRef.current}`)
    if (!activeWord || directorRef.current.helpAvailable || frozenRef.current || stageRef.current !== 'racing') {
      recordVoiceTrace('tap/start: blocked by race guard')
      return
    }
    if (voiceAttemptWordRef.current !== activeWord) {
      cancelRetryPrompt()
      pendingVoiceActionRef.current = null
      voiceAttemptWordRef.current = activeWord
      voiceAttemptModeRef.current = 'isolated'
    }
    if (fromChildGesture) {
      handsFreeListeningRef.current = true
      setHandsFreeListening(true)
    }
    if (recognitionOpenRef.current) {
      if (fromChildGesture && recognitionCloseReasonRef.current !== null) {
        restartAfterEndRef.current = true
        recordVoiceTrace('tap/start: queued until previous end')
      }
      recordVoiceTrace('tap/start: blocked until previous end')
      return
    }
    const port = recognitionRef.current ?? createRecognitionPort(window)
    if (!port) {
      recordVoiceTrace('tap/start: recognition port unavailable')
      interruptSpeech('service-not-allowed')
      return
    }
    recognitionRef.current = port
    const token = recognitionTokenRef.current + 1
    recognitionTokenRef.current = token
    recognitionOpenRef.current = true
    recognitionCloseReasonRef.current = null
    restartAfterEndRef.current = false
    handledVoiceSegmentsRef.current.clear()
    let handled = false
    voiceDiagnostics.begin(token)
    recordVoiceTrace(`session: token=${token} lifecycle=starting`)
    port.start(
      (candidates, isFinal, segmentId) => {
        if (token !== recognitionTokenRef.current) {
          recordVoiceTrace(`result: stale token=${token}`)
          return
        }
        if (!recognitionOpenRef.current) {
          recordVoiceTrace(`result: ended turn token=${token}`)
          voiceDiagnostics.record('result', token, { final: isFinal, actionable: false })
          return
        }
        if (recognitionCloseReasonRef.current !== null) {
          recordVoiceTrace(`result: closing turn token=${token}`)
          voiceDiagnostics.record('result', token, { final: isFinal, actionable: false })
          return
        }
        if (handled) {
          recordVoiceTrace(`result: closed turn token=${token}`)
          voiceDiagnostics.record('result', token, { final: isFinal, actionable: false })
          return
        }
        if (handledVoiceSegmentsRef.current.has(segmentId)) {
          recordVoiceTrace(`result: duplicate segment=${segmentId} token=${token}`)
          voiceDiagnostics.record('result', token, { final: isFinal, actionable: false })
          return
        }
        const transcripts = candidates.map(({ transcript }) => transcript)
        recordVoiceTrace(`result: token=${token} final=${isFinal}${voiceDebug ? ` candidates=${transcripts.join('|')}` : ''}`)
        const outcome = handleCandidates(transcripts, isFinal)
        voiceDiagnostics.record('result', token, { final: isFinal, actionable: outcome !== null })
        if (!outcome) return
        const decision = decideVoiceEvidence(voiceAttemptModeRef.current, outcome)
        if (decision.kind === 'accept') handledVoiceSegmentsRef.current.add(segmentId)
        handled = true
        recognitionCloseReasonRef.current = 'word-resolved'
        restartAfterEndRef.current = decision.kind === 'accept' && handsFreeListeningRef.current
        if (decision.kind === 'prompt-retry' || decision.kind === 'defer') {
          pendingVoiceActionRef.current = { ...decision, word: activeWord }
        }
        if (decision.kind === 'accept' && !isFinal) port.stop()
      },
      (code) => {
        if (token !== recognitionTokenRef.current) {
          recordVoiceTrace(`error: stale ${code} token=${token}`)
          return
        }
        if (!recognitionOpenRef.current) {
          recordVoiceTrace(`error: ended ${code} token=${token}`)
          voiceDiagnostics.record('error', token, { error: code })
          return
        }
        if (recognitionCloseReasonRef.current !== null) {
          recordVoiceTrace(`error: closing ${code} token=${token}`)
          voiceDiagnostics.record('error', token, { error: code })
          return
        }
        recordVoiceTrace(`error: ${code} token=${token}`)
        voiceDiagnostics.record('error', token, { error: code })
        handled = true
        const decision = decideVoiceError(voiceAttemptModeRef.current, code)
        if (decision.kind === 'block') {
          recognitionCloseReasonRef.current = 'error'
          interruptSpeech(decision.code)
          return
        }
        recognitionCloseReasonRef.current = 'word-resolved'
        restartAfterEndRef.current = false
        wordArmedRef.current = false
        audioRef.current?.duck(false)
        setMicrophone('ready')
        pendingVoiceActionRef.current = { ...decision, word: activeWord }
      },
      () => {
        if (token !== recognitionTokenRef.current) return
        const closeReason = recognitionCloseReasonRef.current
        if (!handled && closeReason === null && directorRef.current.activeWord === activeWord) {
          const decision = decideVoiceError(voiceAttemptModeRef.current, 'no-speech')
          if (decision.kind === 'prompt-retry' || decision.kind === 'defer') {
            pendingVoiceActionRef.current = { ...decision, word: activeWord }
          }
        }
        const pendingAction = pendingVoiceActionRef.current
        const willRestart = pendingAction === null && restartAfterEndRef.current && handsFreeListeningRef.current
        recordVoiceTrace(`end: token=${token} restart=${willRestart}`)
        wordArmedRef.current = false
        recognitionOpenRef.current = false
        recognitionCloseReasonRef.current = null
        voiceDiagnostics.record('ended', token, { restart: willRestart })
        if (pendingAction?.kind === 'prompt-retry') {
          setFeedback('That was hard to hear. Listen, then try once more.')
          const promptGeneration = retryPromptGenerationRef.current + 1
          retryPromptGenerationRef.current = promptGeneration
          retryPromptRef.current?.play(pendingAction.word, () => {
            if (
              promptGeneration !== retryPromptGenerationRef.current
              || pendingVoiceActionRef.current !== pendingAction
              || directorRef.current.activeWord !== pendingAction.word
              || frozenRef.current
              || !handsFreeListeningRef.current
            ) return
            pendingVoiceActionRef.current = null
            voiceAttemptModeRef.current = 'carrier'
            setListenAttempt((value) => value + 1)
          })
          return
        }
        if (pendingAction?.kind === 'defer') {
          const current = directorRef.current
          if (current.activeWord === pendingAction.word) publishDirector(deferActiveWord(current))
          resetVoiceAttempt()
          setSpeechReceipt(null)
          setFeedback("Let's bring that word back later. Keep racing!")
          return
        }
        if (willRestart) {
          restartAfterEndRef.current = false
          voiceDiagnostics.record('restart', token)
          setListenAttempt((value) => value + 1)
        }
      },
      () => {
        if (token !== recognitionTokenRef.current) {
          recordVoiceTrace(`start: stale token=${token}`)
          return
        }
        if (!recognitionOpenRef.current || recognitionCloseReasonRef.current !== null || frozenRef.current) {
          recordVoiceTrace(`start: closing token=${token}`)
          return
        }
        recordVoiceTrace(`start: token=${token} lifecycle=listening`)
        voiceDiagnostics.record('listening', token)
        wordArmedRef.current = true
        setMicrophone('listening')
        setSpeechReceipt(null)
        audioRef.current?.duck(true)
      },
    )
  }, [cancelRetryPrompt, handleCandidates, interruptSpeech, publishDirector, recordVoiceTrace, resetVoiceAttempt, voiceDebug, voiceDiagnostics])

  const handleTimeout = useCallback(() => {
    const current = directorRef.current
    if (!current.activeWord || current.activeSinceMs === null) return
    const next = timeoutActiveWord(current, wordClockMsRef.current)
    if (next === current) return
    setSpeechReceipt(null)
    endRecognitionTurn()
    publishDirector(next)
    audioRef.current?.timeout()
    setFeedback(next.helpAvailable ? 'This word needs a grown-up pit stop.' : 'Time is up. That word will come back after two others.')
  }, [endRecognitionTurn, publishDirector])

  const finishRace = useCallback((finalRace: RaceState) => {
    if (finishedRef.current) return
    finishedRef.current = true
    stopRecognition()
    setSpeechReceipt(null)
    setWordTurboRatio(0)
    audioRef.current?.finish(finalRace.placement)
    stageRef.current = 'finished'
    setStage('finished')
    const results = directorRef.current.results
    const practiceWords = results
      .filter((result) => result.outcome === 'timeout' || result.outcome === 'assisted' || result.outcome === 'skipped' || result.outcome === 'deferred')
      .map((result) => result.word)
      .filter((word, index, words) => words.indexOf(word) === index)
    if (practiceWords.length > 0) refitStore.addSkippedWords(practiceWords)
    const fastestWords = [...results]
      .filter((result) => result.outcome === 'accepted' && result.elapsedMs !== null && !practiceWords.includes(result.word))
      .sort((left, right) => (left.elapsedMs ?? WORD_WINDOW_MS) - (right.elapsedMs ?? WORD_WINDOW_MS))
      .map((result) => result.word)
      .filter((word, index, words) => words.indexOf(word) === index)
      .slice(0, 5)
    finishTimerRef.current = window.setTimeout(() => {
      onFinishedRef.current({ placement: finalRace.placement, fastestWords, practiceWords })
    }, 650)
  }, [stopRecognition])

  useEffect(() => {
    if (stage !== 'countdown') return
    const totalMs = countdownMsRef.current
    const startedAt = performance.now()
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      setCountdownLight(Math.max(1, 3 - Math.floor((elapsed / totalMs) * 3)))
    }, Math.max(16, totalMs / 12))
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval)
      stageRef.current = 'racing'
      setStage('racing')
      setFeedback('Read it!')
    }, totalMs)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'racing') return
    let frame = 0
    let lastFrame = performance.now()
    let accumulator = 0
    let lastPublished = lastFrame

    const tick = (now: number) => {
      const realDelta = Math.min((now - lastFrame) / 1000, 0.1)
      lastFrame = now
      if (!frozenRef.current) {
        const gameDelta = realDelta * timeScaleRef.current
        if (wordArmedRef.current) wordClockMsRef.current += gameDelta * 1000
        const active = directorRef.current
        if (active.activeSinceMs !== null && wordArmedRef.current && wordClockMsRef.current - active.activeSinceMs >= WORD_WINDOW_MS) {
          handleTimeout()
        }

        accumulator += gameDelta
        let steps = 0
        while (accumulator >= FIXED_STEP_SECONDS && steps < 240 && !raceRef.current.finished) {
          raceRef.current = stepRace(raceRef.current, { deltaSeconds: FIXED_STEP_SECONDS, steering: steeringRef.current })
          accumulator -= FIXED_STEP_SECONDS
          steps += 1
        }

        const currentLap = Math.min(3, Math.floor(raceRef.current.player.progress / TRACK_LENGTH) + 1)
        if (currentLap > lastLapRef.current) {
          lastLapRef.current = currentLap
          audioRef.current?.lap(currentLap)
        }
        const onGrass = Math.abs(raceRef.current.player.lateralPosition) >= 0.7
        audioRef.current?.setSurface(onGrass ? 'grass' : 'track')
        audioRef.current?.setEngine(onGrass ? 0.45 : 0.7 + raceRef.current.player.boost * 0.3)

        if (now - lastPublished >= 33 || raceRef.current.finished) {
          setRace(raceRef.current)
          const turboRatio = active.activeSinceMs === null || active.helpAvailable
            ? 0
            : clamp01(1 - (wordClockMsRef.current - active.activeSinceMs) / WORD_WINDOW_MS)
          setWordTurboRatio(turboRatio)
          lastPublished = now
        }
        if (raceRef.current.finished) {
          finishRace(raceRef.current)
          return
        }
      }
      frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [finishRace, handleTimeout, stage])

  useEffect(() => {
    if (stage !== 'racing' || frozen || director.helpAvailable || celebrating) return
    if (director.activeWord === null) {
      const timeout = window.setTimeout(() => {
        if (stageRef.current !== 'racing' || frozenRef.current || directorRef.current.activeWord !== null) return
        const next = showNextWord(directorRef.current, wordClockMsRef.current)
        setSpeechReceipt(null)
        publishDirector(next)
      }, 70)
      return () => window.clearTimeout(timeout)
    }

    if (handsFreeListeningRef.current && pendingVoiceActionRef.current === null && !recognitionOpenRef.current && !wordArmedRef.current && microphone !== 'listening') {
      const frame = window.requestAnimationFrame(() => startRecognition())
      return () => window.cancelAnimationFrame(frame)
    }

  }, [celebrating, director, frozen, listenAttempt, microphone, publishDirector, stage, startRecognition])

  useEffect(() => {
    if (stage !== 'racing') return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || stageRef.current !== 'racing') return
      if (frozen) {
        if (hidden) handsFreeListeningRef.current = false
        stopRecognition(speechIssue ? 'interrupted' : 'ready')
        audioRef.current?.pause()
      } else {
        restartAfterEndRef.current = handsFreeListeningRef.current
        audioRef.current?.resume()
        setListenAttempt((value) => value + 1)
      }
    })
    return () => { cancelled = true }
  }, [frozen, hidden, speechIssue, stage, stopRecognition])

  async function startRace() {
    if (!isCompleteWorldAssetBundle(route, assets)) return
    const config = process.env.NODE_ENV !== 'production' ? window.__tinyGrandPrixTest : undefined
    const seed = config?.seed ?? DEFAULT_SEED
    const nextRace = createRace({ playerColour: kartColour, seed, speedModifier, handlingModifier })
    const shuffle = seededShuffle(seed ^ 0x51a7)
    const nextDirector = createWordDirector(bankForDifficulty(difficulty), shuffle)
    raceRef.current = nextRace
    directorRef.current = nextDirector
    wordClockMsRef.current = 0
    wordArmedRef.current = false
    handsFreeListeningRef.current = false
    setHandsFreeListening(false)
    resetVoiceAttempt()
    recognitionOpenRef.current = false
    recognitionCloseReasonRef.current = null
    restartAfterEndRef.current = false
    timeScaleRef.current = config?.timeScale ?? 1
    countdownMsRef.current = config?.countdownMs ?? DEFAULT_COUNTDOWN_MS
    finishedRef.current = false
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current)
      finishTimerRef.current = null
    }
    lastLapRef.current = 1
    steeringRef.current = 0
    setRace(nextRace)
    setDirector(nextDirector)
    setWordTurboRatio(0)
    setSpeechIssue(null)
    setSpeechReceipt(null)
    setCelebrating(false)
    setManualPaused(false)
    setWebglIssue(false)
    setCountdownLight(3)
    await audioRef.current?.unlock()
    audioRef.current?.setMuted(muted)
    audioRef.current?.startRace()
    stageRef.current = 'countdown'
    setStage('countdown')
  }

  function togglePause() {
    setSpeechReceipt(null)
    setManualPaused((value) => !value)
  }

  function retrySpeech() {
    setSpeechIssue(null)
    setMicrophone('ready')
  }

  function recalibrate() {
    tiltRef.current?.calibrate()
    setNeedsRecalibration(false)
  }

  function exitRace() {
    stopRecognition()
    setSpeechReceipt(null)
    onExit()
  }

  function assistWord() {
    setSpeechReceipt(null)
    const next = assistActiveWord(directorRef.current)
    publishDirector(next)
    setFeedback('Pit stop complete. Keep racing!')
  }

  function skipWord() {
    const current = directorRef.current
    if (stageRef.current !== 'racing' || frozenRef.current || current.activeWord === null) return

    const skipped = skipActiveWord(current)
    if (skipped.state === current) return

    setSpeechReceipt(null)
    endRecognitionTurn()
    publishDirector(skipped.state)
    setFeedback('Skipped — practise it after the race.')
  }

  function setTouchSteering(value: number) {
    if (steeringMode === 'touch') steeringRef.current = value
  }

  return (
    <section className="relative mx-auto w-full max-w-6xl">
      <div className="relative">
        <TinyGrandPrixScene
          race={race}
          activeWord={stage === 'racing' ? director.activeWord : null}
          turboRatio={wordTurboRatio}
          playerColour={kartColour}
          reducedMotion={reducedMotion}
          paused={stage !== 'racing' || frozen}
          route={route}
          assets={assets}
          equippedCarModel={equippedCarModel}
          onContextLost={() => setWebglIssue(true)}
        />

        {stage === 'racing' && (
          <RaceHud
            placement={race.placement}
            lap={lap}
            microphone={microphone}
            muted={muted}
            paused={manualPaused}
            onMute={() => setMuted((value) => { audioRef.current?.setMuted(!value); return !value })}
            onPause={togglePause}
            onExit={exitRace}
          />
        )}

        {stage === 'grid' && <Overlay title="Four karts. Three laps. One tiny cup."><button type="button" onClick={startRace} className="min-h-12 rounded-full px-7 text-base font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Start race</button></Overlay>}
        {stage === 'countdown' && <Overlay title={`${countdownLight}`} detail="Engines ready…" />}
        {stage === 'finished' && <Overlay title="Finish!" detail="The final order is in." />}
        {stage === 'racing' && manualPaused && <Overlay title="Race paused" detail="The race, word timer, microphone, and sound are frozen together."><button type="button" onClick={togglePause} className="min-h-12 rounded-full px-7 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Resume</button></Overlay>}
        {stage === 'racing' && speechIssue && <Overlay title="Voice took a pit stop" detail={speechIssue}><button type="button" onClick={retrySpeech} className="min-h-12 rounded-full px-7 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Tap to try again</button></Overlay>}
        {stage === 'racing' && !landscape && <Overlay title="Turn the iPad sideways" detail="Everything is safely paused." />}
        {stage === 'racing' && landscape && needsRecalibration && <Overlay title="Recalibrate steering" detail="Hold the iPad in its new racing position."><button type="button" onClick={recalibrate} className="min-h-12 rounded-full px-7 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Calibrate steering</button></Overlay>}
        {webglIssue && <Overlay title="The track renderer stopped" detail="No race progress was counted after the graphics context was lost."><button type="button" onClick={exitRace} className="min-h-12 rounded-full px-7 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Return to setup</button></Overlay>}

        {stage === 'racing' && director.helpAvailable && !frozen && (
          <div className="absolute inset-x-3 bottom-4 z-20 flex justify-center">
            <button type="button" onClick={assistWord} className="min-h-12 rounded-full border px-6 font-bold shadow-lg" style={{ background: 'var(--surface-2)', borderColor: 'var(--brand-yellow)', color: 'var(--brand-yellow)' }}>Help them through</button>
          </div>
        )}

        {stage === 'racing' && director.activeWord !== null && !frozen && (
          <button
            type="button"
            data-testid="skip-word"
            aria-label="Skip"
            onClick={skipWord}
            className="absolute top-1/2 z-20 min-h-16 min-w-24 -translate-y-1/2 rounded-full border px-5 text-lg font-bold shadow-lg"
            style={{
              right: 'max(1rem, env(safe-area-inset-right))',
              background: 'var(--brand-yellow)',
              borderColor: 'var(--grand-prix-gantry)',
              color: 'var(--brand-navy)',
            }}
          >
            Skip <span aria-hidden="true">→</span>
          </button>
        )}

        {stage === 'racing' && steeringMode === 'touch' && !frozen && (
          <div data-testid="touch-steering" className="absolute inset-x-4 bottom-4 z-10 flex justify-between" aria-label="Touch steering">
            <button type="button" aria-label="Steer left" onPointerDown={() => setTouchSteering(1)} onPointerUp={() => setTouchSteering(0)} onPointerCancel={() => setTouchSteering(0)} onPointerLeave={() => setTouchSteering(0)} className="min-h-16 min-w-24 rounded-full border text-3xl font-bold" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-strong)' }}>←</button>
            <button type="button" aria-label="Steer right" onPointerDown={() => setTouchSteering(-1)} onPointerUp={() => setTouchSteering(0)} onPointerCancel={() => setTouchSteering(0)} onPointerLeave={() => setTouchSteering(0)} className="min-h-16 min-w-24 rounded-full border text-3xl font-bold" style={{ background: 'var(--surface-2)', borderColor: 'var(--line-strong)' }}>→</button>
          </div>
        )}

        {stage === 'racing' && !director.helpAvailable && !frozen && (director.activeWord !== null || celebrating) && (
          <div className="absolute inset-x-3 top-[47%] z-20 flex justify-center">
            {celebrating ? (
              <div aria-live="polite" className="rounded-full px-6 py-3 text-base font-bold shadow-lg" style={{ background: 'var(--race-success)', color: 'var(--brand-navy)' }}>
                <p>{speechReceipt ? speechReceiptText(speechReceipt) : 'Correct! Turbo boost!'}</p>
              </div>
            ) : microphone === 'listening' ? (
              <p aria-live="polite" className="rounded-full px-5 py-3 text-base font-bold shadow-lg" style={{ background: 'var(--surface-2)', color: 'var(--grand-prix-kart-stripe)' }}>Listening… say the word!</p>
            ) : handsFreeListening ? (
              <p aria-live="polite" className="rounded-full px-5 py-3 text-base font-bold shadow-lg" style={{ background: 'var(--surface-2)', color: 'var(--grand-prix-kart-stripe)' }}>Listening… next word is loading!</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button type="button" onClick={() => startRecognition(true)} className="min-h-12 rounded-full border px-6 text-base font-bold shadow-lg" style={{ background: 'var(--brand-yellow)', borderColor: 'var(--grand-prix-kart-stripe)', color: 'var(--brand-navy)' }}>Tap mic, then say it</button>
                <p aria-live="polite" className="rounded-full px-4 py-1 text-xs font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>The timer starts when the mic is ready.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {voiceDebug && (
        <aside className="mt-3 rounded-lg border p-3 text-xs leading-5" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)', color: 'var(--text-secondary)' }}>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Voice trace, not saved</p>
          <p>Current: stage={stage}, mic={microphone}, frozen={String(frozen)}</p>
          <ol className="mt-1 list-decimal pl-5">{voiceTrace.length ? voiceTrace.map((event, index) => <li key={`${event}-${index}`}>{event}</li>) : <li>Waiting for the microphone tap.</li>}</ol>
        </aside>
      )}

      <p aria-live="polite" className="mt-3 min-h-6 text-center text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{feedback}</p>
    </section>
  )
}

function speechReceiptText(receipt: Exclude<SpeechReceipt, null>): string {
  if (receipt.kind === 'exact') return 'Turbo!'
  return 'That works. Turbo!'
}

function Overlay({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center rounded-xl p-5" style={{ background: 'var(--surface-1)' }}>
      <div className="max-w-md text-center">
        <h2 className="text-3xl font-bold sm:text-5xl">{title}</h2>
        {detail && <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{detail}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  )
}

function seededShuffle(seed: number): (words: readonly string[]) => readonly string[] {
  let value = seed >>> 0
  const random = () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
  return (words) => {
    const shuffled = [...words]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }
    return shuffled
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
