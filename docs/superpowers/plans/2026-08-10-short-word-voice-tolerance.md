# Short-word Voice Tolerance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably accept known short-word speech-recognition confusions without accepting unrelated answers or adding a paid service.

**Architecture:** The recognition port preserves every non-empty browser alternative and its optional confidence. The race screen passes transcripts to the existing expected-word matcher, which adds an asymmetric short-word confusion map after exact and generated pronunciation matches.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Vitest, native Web Speech API.

## Global Constraints

- Keep the private browser-only voice flow; add no cloud service, storage, audio recording, or transcript recording.
- Preserve `en-SG`, five alternatives, interim-result processing, and current error handling.
- Never apply generic edit distance or generic phonetics to a short target.
- Apply a configured confusion only to its exact expected target.
- Do not modify unrelated dirty-worktree files.

---

## File structure

- Modify `lib/spelling-race/voiceCapability.ts`: structured alternatives and no global confidence filter.
- Modify `lib/spelling-race/voiceCapability.test.ts`: port forwarding coverage.
- Modify `components/spelling-race/RaceScreen.tsx`: convert structured alternatives to transcript strings at the matcher boundary.
- Modify `components/spelling-race/VoicePocClient.tsx`: retain its count-only diagnostic callback.
- Modify `lib/spelling-race/transcriptMatcher.ts`: target-specific short-word confusion map.
- Modify `lib/spelling-race/transcriptMatcher.test.ts`: acceptance, isolation, and exact-priority coverage.

### Task 1: Preserve all recognition alternatives

**Files:**

- Modify: `lib/spelling-race/voiceCapability.ts`
- Modify: `lib/spelling-race/voiceCapability.test.ts`
- Modify: `components/spelling-race/RaceScreen.tsx`
- Modify: `components/spelling-race/VoicePocClient.tsx`

**Interfaces:**

- Produces: `RecognitionCandidate = { transcript: string; confidence: number | null }`.
- Produces: `RecognitionPort.start` callback candidates as `readonly RecognitionCandidate[]`.
- Consumes: the existing string-only matcher by mapping `candidates.map(({ transcript }) => transcript)` in `RaceScreen`.

- [ ] **Step 1: Write the failing port test**

In `voiceCapability.test.ts`, replace the confidence-filter assertion with:

```ts
expect(received).toEqual([[
  { transcript: 'five', confidence: 0.95 },
  { transcript: 'fife', confidence: 0.42 },
  { transcript: 'and', confidence: 0 },
  { transcript: 'an', confidence: null },
]])
```

Feed those four alternatives in one final fake recognition result, and update all earlier port expectations from strings to `{ transcript, confidence }` objects.

- [ ] **Step 2: Verify it fails**

Run: `npm test -- lib/spelling-race/voiceCapability.test.ts`

Expected: FAIL because the existing port filters low or missing confidence and emits strings.

- [ ] **Step 3: Implement the port boundary**

In `voiceCapability.ts`, delete `SPEECH_MIN_CONFIDENCE`, export:

```ts
export type RecognitionCandidate = {
  transcript: string
  confidence: number | null
}
```

Map every non-empty native alternative to that type, using `alternative.confidence ?? null`. Map every injected development string to `{ transcript, confidence: null }`. Change both port callback signatures to the structured type. In `RaceScreen`, call:

```ts
handleCandidates(candidates.map(({ transcript }) => transcript), isFinal)
```

- [ ] **Step 4: Verify focused tests**

Run: `npm test -- lib/spelling-race/voiceCapability.test.ts lib/spelling-race/transcriptMatcher.test.ts`

Expected: PASS; all candidates now reach the matcher boundary.

- [ ] **Step 5: Commit**

```bash
git add lib/spelling-race/voiceCapability.ts lib/spelling-race/voiceCapability.test.ts components/spelling-race/RaceScreen.tsx components/spelling-race/VoicePocClient.tsx
git commit -m "feat: preserve speech recognition alternatives"
```

### Task 2: Add narrow short-word tolerance

**Files:**

- Modify: `lib/spelling-race/transcriptMatcher.ts`
- Modify: `lib/spelling-race/transcriptMatcher.test.ts`

**Interfaces:**

- Produces: `SHORT_WORD_CONFUSIONS`, initially `{ an: ['and'] }`.
- Produces: the existing phonetic accepted outcome for a configured confusion.
- Consumes: normalized transcript strings, preserving the public `evaluateSightWordAnswer` signature.

- [ ] **Step 1: Write the failing matcher test**

```ts
it('accepts only configured short-word speech confusions', () => {
  expect(evaluateSightWordAnswer('an', ['and'])).toEqual({
    outcome: 'accepted', match: 'phonetic', detected: 'and',
  })
  expect(evaluateSightWordAnswer('am', ['and'])).toEqual({
    outcome: 'retry', reason: 'different-word', detected: 'and',
  })
  expect(evaluateSightWordAnswer('an', ['and', 'an'])).toEqual({
    outcome: 'accepted', match: 'exact', detected: 'an',
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `npm test -- lib/spelling-race/transcriptMatcher.test.ts`

Expected: FAIL because no short-word map exists.

- [ ] **Step 3: Implement the map**

Add this constant next to the generated lexicon bindings:

```ts
const SHORT_WORD_CONFUSIONS: Readonly<Record<string, readonly string[]>> = {
  an: ['and'],
}
```

After the generated-homophone loop and before the pronunciation-signature loop, accept only `SHORT_WORD_CONFUSIONS[expected]?.includes(candidate)`. Return the existing `phonetic` outcome. Do not alter `isStrongPhoneticVariant` or its five-character guard.

- [ ] **Step 4: Verify focused tests**

Run: `npm test -- lib/spelling-race/transcriptMatcher.test.ts`

Expected: PASS, including existing false-positive rejections.

- [ ] **Step 5: Commit**

```bash
git add lib/spelling-race/transcriptMatcher.ts lib/spelling-race/transcriptMatcher.test.ts
git commit -m "feat: tolerate configured short-word transcripts"
```

### Task 3: Verify the complete change

**Files:** Verify only the six files changed in Tasks 1 and 2.

**Interfaces:** Verifies structured callback type compatibility, matcher safety, lint, build, and isolation from pre-existing work.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint && npm run build`

Expected: both commands exit 0.

- [ ] **Step 3: Confirm scope**

Run: `git show --stat --oneline HEAD~1..HEAD && git status --short`

Expected: the two feature commits include only planned voice files; unrelated prior changes remain untouched.
