import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryPromptPort, type RetryPromptUtterance } from './retryVoicePrompt'

afterEach(() => vi.useRealTimers())

describe('retry voice prompt', () => {
  it('speaks the word and carrier phrase, then completes once', () => {
    const done = vi.fn()
    let utterance: RetryPromptUtterance | null = null
    const port = createRetryPromptPort({
      makeUtterance: (text) => ({ text, lang: '', rate: 1, onend: null, onerror: null }),
      speak: (value) => { utterance = value },
      cancel: vi.fn(),
    })

    port.play('bright', done)
    expect(utterance?.text).toBe('bright. I can read bright.')
    expect(utterance?.lang).toBe('en-SG')
    utterance?.onend?.()
    utterance?.onerror?.()
    expect(done).toHaveBeenCalledOnce()
  })

  it('falls back when synthesis is unavailable', () => {
    const done = vi.fn()
    createRetryPromptPort(null).play('cat', done)
    expect(done).toHaveBeenCalledOnce()
  })

  it('times out a stuck prompt and suppresses completion after cancel', () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const cancel = vi.fn()
    const port = createRetryPromptPort({
      makeUtterance: (text) => ({ text, lang: '', rate: 1, onend: null, onerror: null }),
      speak: () => undefined,
      cancel,
    })

    port.play('cat', done)
    vi.advanceTimersByTime(3_000)
    expect(done).toHaveBeenCalledOnce()

    port.play('dog', done)
    port.cancel()
    vi.advanceTimersByTime(3_000)
    expect(cancel).toHaveBeenCalled()
    expect(done).toHaveBeenCalledOnce()
  })
})
