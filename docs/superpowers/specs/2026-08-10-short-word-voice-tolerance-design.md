# Short-word voice tolerance design

## Goal

Make the sight-word race reliably accept correct spoken short words when the browser's speech recognizer returns a plausible near-transcription, without making unrelated answers pass.

## Scope

This change improves the current Web Speech API flow only. It does not add a cloud speech service, record audio or transcripts, or replace the recognizer with Vosk or Whisper. A future offline-recognizer spike is explicitly separate work.

## Problem

The app currently removes all recognition alternatives below a global confidence threshold of 0.80 before matching. Browser confidence is especially unreliable for short isolated words. The matcher also intentionally avoids broad fuzzy matching for short targets, which protects against false positives but rejects known transcription confusions such as target `an` becoming `and`.

## Architecture

### Recognition port

The recognition port will expose each non-empty alternative with its transcript and optional confidence, preserving the browser's ranking. It will no longer discard alternatives by a global confidence cutoff.

### Expected-word matcher

The matcher remains the sole authority that accepts an answer. It will evaluate alternatives in this order:

1. Exact normalized transcript.
2. Existing generated homophone and pronunciation-signature matches.
3. A new, explicit short-word confusion map keyed by the expected word.
4. The existing tightly bounded phonetic fallback for targets of five or more characters.

The short-word map is asymmetric and target-specific. For example, `and` can be accepted only while the expected word is `an`; it is not accepted as a general synonym. It must contain only observed or deliberately reviewed variants. Broad edit-distance and generic phonetic matching remain prohibited for targets under five characters.

## Data flow and user feedback

The browser sends all non-empty alternatives to the matcher. The matcher selects the safest successful result, preferring exact over tolerant matches regardless of browser ranking. It returns the detected transcript and match type to the race screen.

The ordinary child-facing behaviour stays unchanged: accepted answers receive a boost and unrelated answers prompt another try. Existing in-memory feedback may identify a phonetic acceptance as it does today; no transcript, audio, or word-level diagnostics are persisted or sent off-device.

## Error handling and safety

Empty alternatives are ignored. Missing confidence is allowed because confidence no longer controls eligibility. Recognition-service and microphone errors retain their current handling.

The safety boundary is the expected-word-only map plus the existing matcher order. A candidate is never accepted merely because it is short, low-confidence, or one edit away from a target.

## Testing

Add unit tests that prove:

- all non-empty alternatives, including low-confidence and confidence-less ones, reach the matcher in ranked order;
- expected `an` accepts detected `and` as a phonetic/tolerant match;
- another expected word does not accept `and` solely because the map contains the `an` rule;
- exact alternatives win over tolerant alternatives;
- existing short-word rejections and long-word phonetic behaviour remain unchanged.

## Success criteria

During a voice check with the existing browser recognizer, plausible short-word substitutions are accepted only for their configured target word. The game keeps rejecting unrelated short words, runs without a paid service, and does not store audio or transcripts.
