'use client'

import type { RacePlacement, RaceRecap } from '@/lib/spelling-race/types'

type RaceFinishProps = {
  recap: RaceRecap
  onRaceAgain(): void
  onChangeSetup(): void
}

export default function RaceFinish({ recap, onRaceAgain, onChangeSetup }: RaceFinishProps) {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border p-6 text-center sm:p-8" style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--brand-yellow)' }}>Chequered flag</p>
      <h2 className="mt-2 text-4xl font-bold">{ordinal(recap.placement)} place!</h2>
      <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Three laps finished against three real rivals.</p>

      <div className="mt-6 grid gap-4 text-left sm:grid-cols-2">
        <RecapWords title="Fastest recognised words" words={recap.fastestWords} empty="No recognised words this time." />
        <RecapWords title="Practise together" words={recap.practiceWords} empty="No words need extra practice." />
      </div>

      <p className="mt-5 text-xs" style={{ color: 'var(--text-tertiary)' }}>This recap lives only on this screen. Refreshing or leaving clears it.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRaceAgain} className="min-h-12 rounded-full px-6 font-bold" style={{ background: 'var(--brand-yellow)', color: 'var(--brand-navy)' }}>Race again</button>
        <button type="button" onClick={onChangeSetup} className="min-h-12 rounded-full border px-6 font-semibold" style={{ borderColor: 'var(--line-strong)', color: 'var(--text-secondary)' }}>Change difficulty or kart</button>
      </div>
    </section>
  )
}

function RecapWords({ title, words, empty }: { title: string; words: readonly string[]; empty: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--fill-ghost)', borderColor: 'var(--line)' }}>
      <h3 className="font-bold">{title}</h3>
      {words.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {words.map((word) => <li key={word} className="rounded-full border px-3 py-1 text-sm lowercase" style={{ borderColor: 'var(--line-strong)' }}>{word}</li>)}
        </ul>
      ) : <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{empty}</p>}
    </div>
  )
}

function ordinal(placement: RacePlacement): string {
  return placement === 1 ? '1st' : placement === 2 ? '2nd' : placement === 3 ? '3rd' : '4th'
}
