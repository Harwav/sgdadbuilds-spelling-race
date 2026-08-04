'use client'

import { useSearchParams } from 'next/navigation'
import { routeCard, SINGAPORE_HEARTLAND_ROUTE } from '@/lib/spelling-race/world/routes'
import SpellingRaceClient from './SpellingRaceClient'

export default function SpellingRacePageClient() {
  const searchParams = useSearchParams()
  const route = developmentRouteOverride(searchParams.get('route-card'))
  return <SpellingRaceClient route={route} />
}

function developmentRouteOverride(routeId: string | null) {
  if (process.env.NODE_ENV === 'production') return SINGAPORE_HEARTLAND_ROUTE
  if (routeId === 'fixture-harbour') return routeCard(routeId)
  return SINGAPORE_HEARTLAND_ROUTE
}
