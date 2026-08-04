export type AnalyticsEvent = 'spelling_voice_debug'

type EventData = Record<string, string | number | boolean>

/**
 * Analytics seam kept deliberately inert in the public copy.
 * The game never sends audio, transcripts, or child results anywhere.
 */
export function track(event: AnalyticsEvent, data?: EventData): void {
  void event
  void data
}
