# Zero-cost child voice resilience design

## Goal

Keep the race moving when Safari mistranscribes a child's reasonable accented pronunciation, without awarding a correct result when the child genuinely says the wrong word and without adding a paid speech service.

## Context

The game currently uses Safari's Web Speech API with `en-SG`, interim results, and up to five recognition alternatives. The matcher accepts exact transcripts, generated homophones, pronunciation signatures, one configured short-word confusion (`an` detected as `and`), and a bounded Double Metaphone fallback for targets of at least five characters.

That flow treats a general-purpose transcript as the primary evidence of pronunciation. This is unreliable for isolated child speech, especially short sight words. The app also presents a blocking voice-error overlay for recognition-service failures. A recognizer mistake can therefore feel like the child failed or can interrupt the race entirely.

At zero recurring cost, the browser cannot reliably distinguish every genuine pronunciation error from every transcription error. The design must preserve that uncertainty instead of converting it into either a false success or a blocking failure.

## Product policy

Voice handling has three outcomes:

1. **Accepted:** strong evidence supports the expected word. Award the normal turbo.
2. **Retry:** the first completed attempt is not strong enough. Give neutral feedback, play the expected word, and request one scaffolded retry.
3. **Deferred:** the second attempt is still unresolved or the recognition service fails transiently. Award no turbo, record the word for later practice, requeue it through the existing word director, and continue the race immediately.

`Deferred` is not described to the child as a pronunciation mistake. The app says that the word was hard to hear and will return. Only a strong match earns success. A permission denial or unavailable microphone can still block voice play because the child cannot continue by voice; ordinary `no-speech`, network, aborted-session, and start failures must not freeze the race.

## Architecture

### Recognition port

The existing recognition port remains the browser boundary and continues to return all non-empty alternatives with optional confidence. It does not decide correctness.

No cloud API, audio upload, audio persistence, or in-browser Whisper/Vosk model is added. Web Speech contextual phrase biasing is not part of the design because it is unavailable in the target iPad Safari environment.

### Expected-word evidence matcher

The matcher remains a pure module. It receives the expected word, recognition candidates, whether the result is final, and the attempt mode. It returns evidence, not game-flow decisions.

Evidence is evaluated in this order:

1. Exact normalized target in any recognition alternative.
2. Existing generated homophone or identical pronunciation-signature match.
3. A reviewed, target-specific recognizer-confusion entry.
4. A weighted pronunciation-distance match for targets of at least five characters, retaining tight first-letter, single-token, and edit-distance protections.
5. No strong evidence.

Short targets remain conservative. A generic edit-distance or generic phonetic match must not accept them because one changed sound can produce a different valid sight word. Short-word tolerant matches require a reviewed target-specific confusion entry.

The confusion lexicon will be expanded only from observed child/device results that have been manually confirmed as correct pronunciations. Each entry is asymmetric and scoped to one expected word. A transcript matching another valid bank word is rejected unless the exact target/confusion pair was reviewed explicitly.

Browser confidence is retained for diagnostics but cannot independently accept or reject a word. Confidence values are inconsistent across browsers and are often absent or unreliable for short utterances.

### Scaffolded retry

The race owns a per-word attempt count, separate from recognition session tokens and lifecycle restarts.

On the first final non-match:

1. End the current recognition turn cleanly.
2. Pause the word timer while the prompt is played.
3. Use browser speech synthesis to say the expected word once.
4. Show and speak the fixed carrier prompt: `I can read <word>`.
5. Restart recognition and ask the child to repeat the carrier phrase.

The second-attempt matcher removes the fixed carrier words and evaluates the final content token with the same target-specific evidence rules. The fixed carrier words themselves never count as evidence for the target. If speech synthesis is unavailable, the written carrier prompt is shown and the retry still proceeds.

Speech synthesis and recognition must never run simultaneously. The recognizer is stopped before prompting and restarted only after synthesis ends or after a bounded synthesis timeout.

### Race continuity controller

`RaceScreen` maps matcher evidence and attempt count into product outcomes:

- Strong evidence on either attempt calls the existing accepted-word path and awards turbo based on active listening time.
- No strong evidence on attempt one starts the scaffolded retry without resolving or timing out the word.
- No strong evidence on attempt two resolves the attempt as deferred, awards no boost, and places the word into the existing retry queue after two other resolved words.
- A transient recognition error follows the same bounded policy: retry once if no retry has occurred, otherwise defer the word.
- Permission or capability failures retain the blocking parent-facing recovery UI.

The word clock advances only during active listening. It pauses during speech synthesis, recognizer restart latency, feedback, and transitions. Existing manual Skip remains available and has the same practice consequence as today.

The word director gains a `deferred` resolution path or reuses the timeout retry mechanism through a clearly named function. It must not fake a timeout, acceptance, or assisted result. Race recap and Refit treat deferred words as practice words.

## Child-facing feedback

The app must not assert that a transcript is what the child actually said when recognition is uncertain.

- Accepted exact: `Turbo!`
- Accepted reviewed pronunciation variant: `That works. Turbo!`
- First unresolved attempt: `That was hard to hear. Listen, then try once more.`
- Deferred after retry: `Let's bring that word back later. Keep racing!`

The detected transcript remains available only in the opt-in, in-memory `voice-debug` view. It is not shown in ordinary child-facing feedback, persisted, or sent to analytics.

## Error handling

Errors are divided into two classes:

- **Blocking:** microphone permission denied, speech recognition unavailable, or insecure context. Pause the race and show parent recovery controls.
- **Transient:** `no-speech`, `aborted`, network/service failure after readiness, or synchronous start failure. Consume the current attempt according to the retry/defer policy and keep the race moving.

All prompt, restart, and recognition callbacks retain token checks so stale callbacks cannot resolve the current word. Prompt synthesis receives a short timeout so a missing `onend` event cannot stall the race. Unmount, pause, visibility change, skip, exit, and word resolution cancel both recognition and pending speech synthesis.

## Privacy

The design preserves the current privacy boundary:

- no paid or external application service is introduced;
- the app does not record or store raw audio;
- transcripts remain in memory only;
- production analytics receive lifecycle metadata only, never audio, transcripts, child identifiers, or word-level results;
- reviewed confusion entries are developer-authored source data, not automatically learned from children in production.

## Testing

### Matcher unit tests

- Exact results win regardless of candidate rank.
- Existing homophones and pronunciation signatures remain accepted.
- Reviewed short-word confusions apply only to their configured target.
- An unrelated valid bank word is not accepted by generic short-word similarity.
- Carrier-phrase extraction ignores the fixed carrier tokens and evaluates only the expected content.
- Interim non-matches remain non-actionable.
- Missing or low browser confidence does not reject otherwise strong evidence.

### Race-flow tests

- A first final non-match plays the prompt, pauses timing, and starts one scaffolded retry.
- A second non-match awards no boost, requeues the word, and advances immediately.
- A match on the second attempt awards turbo and does not defer the word.
- `no-speech`, network, aborted, and start failures cannot open the blocking pit-stop overlay after readiness.
- Permission denial still opens parent recovery UI.
- Speech synthesis and recognition never overlap.
- Stale recognition or synthesis callbacks cannot resolve a later word.
- Skip, pause, exit, visibility changes, and unmount cancel both voice directions safely.

### Regression and device verification

- Run all unit and component tests, lint, and the production build.
- On the target iPad/Safari combination, test at least 30 utterances covering short words, long words, common homophones, and known troublesome accents.
- Record only aggregate manual counts: correct accepted, correct deferred, incorrect rejected, incorrect accepted, and median time from speech end to the next visible state.

## Success criteria

- No ordinary recognition mismatch or transient recognition error blocks the race.
- A word consumes at most two completed speaking attempts before the race advances.
- A genuinely different short sight word is not accepted through generic fuzzy matching.
- Correct accented pronunciations covered by exact alternatives, generated pronunciations, or reviewed confusion entries earn turbo.
- In the target-device test set, zero observed incorrect pronunciations are accepted; correct-pronunciation deferrals are measured and used to review only target-specific confusion entries.
- Audio and transcripts remain unpersisted and are never sent to application analytics.

## Non-goals

- Perfect pronunciation assessment from browser transcripts.
- Automatic accent learning from child audio.
- A paid cloud speech API.
- Shipping Whisper, Vosk, or another large local ASR model in the initial change.
- Diagnosing speech disorders or grading phoneme-level articulation.

## Future options

If browser-only testing still produces too many correct-pronunciation deferrals, a separate spike can evaluate an on-device model or a paid child-speech verification service against the same recorded-with-consent test set. That work requires its own privacy, latency, cost, and accuracy review and is not part of this design.
