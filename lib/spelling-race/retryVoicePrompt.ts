import { SPEECH_LANGUAGE } from './voiceCapability'

export type RetryPromptUtterance = {
  text: string
  lang: string
  rate: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

type RetryPromptAdapter = {
  makeUtterance(text: string): RetryPromptUtterance
  speak(utterance: RetryPromptUtterance): void
  cancel(): void
}

export type RetryPromptPort = {
  play(word: string, onDone: () => void): void
  cancel(): void
}

export function createRetryPromptPort(
  adapter: RetryPromptAdapter | null,
  timeoutMs = 3_000,
): RetryPromptPort {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const clear = () => {
    if (timeout !== null) clearTimeout(timeout)
    timeout = null
  }

  return {
    play(word, onDone) {
      generation += 1
      const current = generation
      clear()
      if (!adapter) {
        onDone()
        return
      }
      let completed = false
      const finish = () => {
        if (completed || current !== generation) return
        completed = true
        clear()
        onDone()
      }
      const utterance = adapter.makeUtterance(`${word}. I can read ${word}.`)
      utterance.lang = SPEECH_LANGUAGE
      utterance.rate = 0.85
      utterance.onend = finish
      utterance.onerror = finish
      timeout = setTimeout(finish, timeoutMs)
      adapter.speak(utterance)
    },
    cancel() {
      generation += 1
      clear()
      adapter?.cancel()
    },
  }
}

export function createBrowserRetryPromptPort(): RetryPromptPort {
  if (
    typeof window === 'undefined'
    || typeof window.speechSynthesis === 'undefined'
    || typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return createRetryPromptPort(null)
  }
  return createRetryPromptPort({
    makeUtterance: (text) => new SpeechSynthesisUtterance(text),
    speak: (utterance) => window.speechSynthesis.speak(utterance as SpeechSynthesisUtterance),
    cancel: () => window.speechSynthesis.cancel(),
  })
}
