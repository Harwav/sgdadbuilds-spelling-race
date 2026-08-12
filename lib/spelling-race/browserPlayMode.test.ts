import { describe, expect, it } from 'vitest'
import { shouldLaunchBrowserPlayMode } from './browserPlayMode'

describe('browser play mode', () => {
  it('is available only during development with an explicit test query', () => {
    expect(shouldLaunchBrowserPlayMode('development', '?browser-play=1')).toBe(true)
    expect(shouldLaunchBrowserPlayMode('production', '?browser-play=1')).toBe(false)
    expect(shouldLaunchBrowserPlayMode('development', '')).toBe(false)
  })
})
