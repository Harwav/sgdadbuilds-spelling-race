export type TiltPort = {
  requestPermission(): Promise<'granted' | 'fallback'>
  calibrate(): number
  subscribe(listener: (steering: number) => void): () => void
  destroy(): void
}

type OrientationEvent = { beta: number | null; gamma: number | null }
type TiltBrowser = {
  DeviceOrientationEvent?: object
  screen?: { orientation?: { angle?: number } }
  orientation?: number
  addEventListener(type: 'deviceorientation', listener: (event: OrientationEvent) => void): void
  removeEventListener(type: 'deviceorientation', listener: (event: OrientationEvent) => void): void
  __spellingRaceTilt?: TiltPort
}

const DEAD_ZONE = 4
const FULL_SCALE = 20
let sessionNeutralGamma = 0

export function projectLandscapeTilt(sample: { beta: number | null; gamma: number | null; screenAngle: number }): number | null {
  const angle = ((sample.screenAngle % 360) + 360) % 360
  const axis = angle % 180 === 0 ? sample.beta : sample.gamma
  if (typeof axis !== 'number') return null
  return angle === 180 || angle === 270 ? -axis : axis
}

export function normaliseTilt(gamma: number, neutralGamma: number): number {
  const delta = gamma - neutralGamma
  if (Math.abs(delta) <= DEAD_ZONE) return 0
  // In the chase camera, positive lateral position is screen-right. Safari's
  // landscape gamma increases when the device is rolled left, so invert it here
  // once rather than making every control consumer compensate for it.
  return Math.max(-1, Math.min(1, -delta / FULL_SCALE))
}

export function createTiltPort(browser: TiltBrowser): TiltPort {
  if (process.env.NODE_ENV !== 'production' && browser.__spellingRaceTilt) return browser.__spellingRaceTilt

  let neutralGamma = sessionNeutralGamma
  let latestGamma = 0
  const listeners = new Set<(steering: number) => void>()
  const onOrientation = (event: OrientationEvent) => {
    const screenAngle = browser.screen?.orientation?.angle ?? browser.orientation ?? 0
    const projected = projectLandscapeTilt({ beta: event.beta, gamma: event.gamma, screenAngle })
    if (projected === null) return
    latestGamma = projected
    const steering = normaliseTilt(latestGamma, neutralGamma)
    listeners.forEach((listener) => listener(steering))
  }
  const available = Boolean(browser.DeviceOrientationEvent)

  if (available) browser.addEventListener('deviceorientation', onOrientation)

  return {
    async requestPermission() {
      if (!available) return 'fallback'
      try {
        const request = (browser.DeviceOrientationEvent as { requestPermission?: () => Promise<'granted' | 'denied'> } | undefined)?.requestPermission
        return !request || await request() === 'granted' ? 'granted' : 'fallback'
      } catch {
        return 'fallback'
      }
    },
    calibrate() {
      neutralGamma = latestGamma
      sessionNeutralGamma = latestGamma
      return neutralGamma
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy() {
      listeners.clear()
      if (available) browser.removeEventListener('deviceorientation', onOrientation)
    },
  }
}
