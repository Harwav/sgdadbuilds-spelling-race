'use client'

import { useState } from 'react'
import type { LocalWordList, SpellingWord } from '@/lib/spelling-race/types'
import { normaliseWord, saveWordList, validateWordList } from '@/lib/spelling-race/wordList'

export type WordListEditorProps = {
  initialList: LocalWordList
  onSaved: (list: LocalWordList) => void
}

export default function WordListEditor({ initialList, onSaved }: WordListEditorProps) {
  const [title, setTitle] = useState(initialList.title)
  const [words, setWords] = useState(initialList.words)
  const [errors, setErrors] = useState<string[]>([])

  function updateWord(index: number, patch: Partial<SpellingWord>) {
    setWords((current) => current.map((word, wordIndex) => (wordIndex === index ? { ...word, ...patch } : word)))
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= words.length) return
    setWords((current) => {
      const next = [...current]
      ;[next[index], next[destination]] = [next[destination], next[index]]
      return next
    })
  }

  function save() {
    const validation = validateWordList(words.map((word) => word.word))
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    const list: LocalWordList = {
      version: 1,
      title: title.trim() || 'This week’s words',
      words: words.map((word, index) => {
        const normalised = normaliseWord(word.word)
        const changedWord = normalised !== normaliseWord(initialList.words[index]?.word ?? '')
        return {
          ...word,
          id: word.id || `word-${index + 1}-${normalised}`,
          word: normalised,
          sentence: word.sentence?.trim() || undefined,
          aliases: changedWord ? undefined : word.aliases,
        }
      }),
    }

    saveWordList(localStorage, list)
    setErrors([])
    onSaved(list)
  }

  function reset() {
    if (!window.confirm('Reset this list to the starter words? Your current local list will be replaced.')) return
    setTitle(initialList.title)
    setWords(initialList.words)
    setErrors([])
  }

  return (
    <section className="ui-font rounded-xl border p-4 sm:p-6" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Parent setup</p>
          <h2 className="mt-1 text-xl font-bold">This week&apos;s spelling list</h2>
        </div>
        <button type="button" onClick={reset} className="min-h-11 rounded-full border px-4 text-sm font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>
          Reset starter list
        </button>
      </div>

      <label className="mt-5 block text-sm font-semibold" htmlFor="race-list-title">List name</label>
      <input id="race-list-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border px-3 text-base" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)', color: 'var(--text-primary)' }} />

      <div className="mt-5 space-y-3">
        {words.map((word, index) => (
          <div key={word.id || `${word.word}-${index}`} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)', background: 'var(--fill-ghost)' }}>
            <div className="flex items-center gap-2">
              <span className="w-6 text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>{index + 1}</span>
              <input aria-label={`Word ${index + 1}`} value={word.word} onChange={(event) => updateWord(index, { word: event.target.value })} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-base font-semibold" style={{ background: 'var(--surface-1)', borderColor: 'var(--line)', color: 'var(--text-primary)' }} />
              <button type="button" aria-label={`Move ${word.word} up`} onClick={() => move(index, -1)} className="min-h-11 min-w-11 rounded-lg border text-lg" style={{ borderColor: 'var(--line)', color: 'var(--text-primary)' }}>↑</button>
              <button type="button" aria-label={`Move ${word.word} down`} onClick={() => move(index, 1)} className="min-h-11 min-w-11 rounded-lg border text-lg" style={{ borderColor: 'var(--line)', color: 'var(--text-primary)' }}>↓</button>
              <button type="button" aria-label={`Delete ${word.word}`} onClick={() => setWords((current) => current.filter((_, wordIndex) => wordIndex !== index))} className="min-h-11 min-w-11 rounded-lg border text-lg" style={{ borderColor: 'var(--line)', color: 'var(--text-primary)' }}>×</button>
            </div>
            <label className="mt-2 block text-xs" style={{ color: 'var(--text-tertiary)' }}>Optional sentence
              <input aria-label={`Sentence for ${word.word || `word ${index + 1}`}`} value={word.sentence ?? ''} onChange={(event) => updateWord(index, { sentence: event.target.value })} placeholder="e.g. The sun is bright." className="mt-1 min-h-11 w-full rounded-lg border px-3 text-sm" style={{ background: 'var(--surface-1)', borderColor: 'var(--line)', color: 'var(--text-primary)' }} />
            </label>
          </div>
        ))}
      </div>

      {errors.length > 0 && <ul className="mt-4 space-y-1 text-sm" style={{ color: 'var(--status-caution)' }}>{errors.map((error) => <li key={error}>{error}</li>)}</ul>}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={words.length >= 20} onClick={() => setWords((current) => [...current, { id: `new-${Date.now()}`, word: '', sentence: '' }])} className="min-h-11 rounded-full border px-4 text-sm font-bold disabled:opacity-50" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-primary)' }}>
          Add word
        </button>
        <button type="button" onClick={save} className="min-h-11 rounded-full px-5 text-sm font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>
          Save and check voice
        </button>
      </div>
    </section>
  )
}
