import type { Metadata } from 'next'
import { Suspense } from 'react'
import SpellingRacePageClient from './SpellingRacePageClient'

export const metadata: Metadata = {
  title: 'Tiny Grand Prix — SGDadBuilds',
  description: 'A private, voice-powered sight-word kart race for iPad.',
}

export default function SpellingRacePage() {
  return (
    <Suspense fallback={<main className="min-h-full" style={{ background: 'var(--brand-navy)' }} />}>
      <SpellingRacePageClient />
    </Suspense>
  )
}
