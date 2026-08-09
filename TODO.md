# Spelling Race TODO

Findings are ordered by user impact and regression risk. This list records work that is worth fixing; it is not a list of speculative cleanup.

## P1 — Fix before relying on the new 3D buildings

- [ ] Make race construction wait for the optional building GLBs, or rebuild the district when their load completes.
  - Finding: the district reads the building cache once. When a race starts before the asynchronous GLB load finishes, it permanently renders procedural fallback buildings for that race.
  - Affected code: `components/spelling-race/world/buildingLoader.ts`, `components/spelling-race/world/districts/singaporeHeartland.ts`.
  - Done when: a delayed building-model load is covered by an integration test and the completed race scene contains the GLB-based buildings rather than only the fallback geometry.

## P2 — Add regression coverage for child progression

- [ ] Add an integration test for Skip → Refit → upgrade application.
  - Verify that skipping adds the word to Refit, a successful practice attempt removes it, and every three successes change the next race's speed and handling modifiers.

- [ ] Add an integration test for car unlock, equip, and race rendering.
  - Verify that five accepted challenge words unlock exactly one car, it can be equipped, and the selected model reaches both the garage and the race renderer.

## P3 — Remove existing lint warnings in imported UI code

- [ ] Resolve the six current ESLint warnings without changing game behavior.
  - Includes unused imports/variables and `useEffect` dependency warnings in the garage scene.
  - Done when: `npm run lint` exits with zero warnings.
