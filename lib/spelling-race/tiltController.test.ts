import { describe, expect, it } from 'vitest'
import { createTiltPort, normaliseTilt, projectLandscapeTilt } from './tiltController'

describe('normaliseTilt', () => {
  it('uses a four-degree dead zone around the calibrated neutral position', () => {
    expect(normaliseTilt(14, 10)).toBe(0)
    expect(normaliseTilt(6, 10)).toBe(0)
  })

  it('maps twenty degrees from neutral to full steering and clamps beyond it', () => {
    expect(normaliseTilt(20, 10)).toBe(-0.5)
    expect(normaliseTilt(40, 10)).toBe(-1)
    expect(normaliseTilt(-20, 10)).toBe(1)
  })
})

describe('projectLandscapeTilt', () => {
  it('uses beta rather than a static gamma when Safari reports screen angle 180', () => {
    expect(projectLandscapeTilt({ beta: -1.68, gamma: 61.85, screenAngle: 180 })).toBe(1.68)
  })

  it('rotates the selected physical axis with the reported screen angle', () => {
    expect(projectLandscapeTilt({ beta: 7, gamma: 31, screenAngle: 90 })).toBe(31)
    expect(projectLandscapeTilt({ beta: 7, gamma: 31, screenAngle: 270 })).toBe(-31)
  })
})

describe('createTiltPort', () => {
  it('calibrates to the most recent orientation and publishes normalised steering', async () => {
    const browser = orientationBrowser('granted')
    const port = createTiltPort(browser)
    await expect(port.requestPermission()).resolves.toBe('granted')

    browser.emit(8)
    expect(port.calibrate()).toBe(8)

    const values: number[] = []
    const unsubscribe = port.subscribe((steering) => values.push(steering))
    browser.emit(12)
    browser.emit(18)
    unsubscribe()
    browser.emit(-20)

    expect(values).toEqual([0, -0.5])
  })

  it('uses touch fallback when orientation permission is denied or missing', async () => {
    await expect(createTiltPort(orientationBrowser('denied')).requestPermission()).resolves.toBe('fallback')
    await expect(createTiltPort(orientationBrowser()).requestPermission()).resolves.toBe('fallback')
  })

  it('keeps the readiness calibration for the race controller in the same page session', async () => {
    const readinessBrowser = orientationBrowser('granted')
    const readinessPort = createTiltPort(readinessBrowser)
    await readinessPort.requestPermission()
    readinessBrowser.emit(8)
    expect(readinessPort.calibrate()).toBe(8)
    readinessPort.destroy()

    const raceBrowser = orientationBrowser('granted')
    const racePort = createTiltPort(raceBrowser)
    const values: number[] = []
    racePort.subscribe((steering) => values.push(steering))
    raceBrowser.emit(12)

    expect(values).toEqual([0])
  })
})

function orientationBrowser(permission?: 'granted' | 'denied') {
  let listener: ((event: { beta: number | null; gamma: number | null }) => void) | undefined
  return {
    screen: { orientation: { angle: 90 } },
    DeviceOrientationEvent: permission
      ? { requestPermission: async () => permission }
      : undefined,
    addEventListener: (_type: 'deviceorientation', next: (event: { beta: number | null; gamma: number | null }) => void) => {
      listener = next
    },
    removeEventListener: () => {
      listener = undefined
    },
    emit: (gamma: number) => listener?.({ beta: null, gamma }),
  }
}
