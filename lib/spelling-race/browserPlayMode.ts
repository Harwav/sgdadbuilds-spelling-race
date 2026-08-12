export function shouldLaunchBrowserPlayMode(environment: string | undefined, search: string): boolean {
  return environment === 'development' && new URLSearchParams(search).get('browser-play') === '1'
}
