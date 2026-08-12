# Singapore Street Grand Prix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Ship a clear, safe, performant Singapore street-race scene with spline-derived track safety bands, legal kart presentation, an integrated accessible word gantry, and reproducible visual/performance validation.

**Architecture:** \`TrackEnvelope\` becomes the single source of truth for road geometry, road surface sampling, barrier boundaries, and landmark clearance. The district consumes that envelope rather than rebuilding the route curve. Renderer-owned visual kart poses stay separate from race simulation; a parameterised Three.js gantry provides semantic display anchors for accessible DOM projection.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Three.js 0.185.1, Vitest, GLTFLoader, existing browser visual-debug harness.

## Global Constraints

- Before modifying Next.js code, read the relevant guide under \`node_modules/next/dist/docs/\` as required by \`AGENTS.md\`.
- Preserve the voice/word game loop and its existing race-state authority; visual yielding cannot alter race ranking or progress.
- Use one \`TrackEnvelope\` cross-section for road geometry, objects, effects, gantry footings, and kart positions.
- No shipping landmark may intersect the barrier-clearance boundary; optional illegal landmarks are omitted, required illegal landmarks fail route validation.
- Keep repeated geometry instanced or material-merged; do not reintroduce the eager building catalogue or filler-clone expansion.
- Preserve readability elements across all quality tiers; essential UI text/background pairs must meet 4.5:1 contrast and states cannot be colour-only.
- All performance claims require measured physical-iPad Safari evidence; iPad-shaped Chromium screenshots are layout evidence only.

---

## File structure

- \`lib/spelling-race/world/types.ts\` — footprint and marker metadata contracts.
- \`lib/spelling-race/world/trackEnvelope.ts\` — pure track-band tokens, canonical cross-section sampling, safe bounds, and footprint-clearance logic.
- \`components/spelling-race/world/track.ts\` — Three.js mesh and instance construction from \`TrackEnvelope\`.
- \`lib/spelling-race/world/trackEnvelope.test.ts\` — topology, bounds, and clearance invariants.
- \`lib/spelling-race/world/visualPose.ts\` — pure renderer-only kart-pose spacing resolver.
- \`lib/spelling-race/world/visualPose.test.ts\` — circular progress, lane, coincident, and chain-separation cases.
- \`components/spelling-race/world/districts/singaporeHeartland.ts\` — envelope-aware, sparse scenery construction.
- \`components/spelling-race/TinyGrandPrixScene.tsx\` — immediate renderer start plus optional scenery loading.
- \`components/spelling-race/world/gantry.ts\` — procedural gantry semantic factory and state animation.
- \`components/spelling-race/GantryPrompt.tsx\` — physical-display fitted word content only.
- \`components/spelling-race/RaceHud.tsx\` — independent bottom-centre turbo HUD.
- \`components/spelling-race/world/rendererHost.ts\` — visual-pose integration, surface sampling, gantry screen projection, proxy occlusion, and tier budgets.
- \`lib/spelling-race/world/quality.ts\` — explicit per-tier scene policy.
- Existing \`*.test.ts(x)\` — regression replacements and integration coverage.

### Task 1: Introduce the pure track-envelope contract

**Files:**
- Create: \`lib/spelling-race/world/trackEnvelope.ts\`
- Create: \`lib/spelling-race/world/trackEnvelope.test.ts\`
- Modify: \`lib/spelling-race/world/types.ts\`
- Modify: \`lib/spelling-race/world/routes.ts\`

**Interfaces:**
- Produces \`TrackEnvelope\`, \`TrackEnvelopeTokens\`, \`TrackSurfaceSample\`, \`createTrackEnvelope(card)\`, \`surfaceAt(progress, lateral)\`, \`isFootprintClear(footprint)\`.
- Extends \`LandmarkPlacement\` with \`footprint: { halfLength: number; halfWidth: number }\` and adds authored route corner markers.

- [ ] **Step 1: Write the failing topology and clearance tests**

\`\`\`ts
const envelope = createTrackEnvelope(SINGAPORE_HEARTLAND_ROUTE)
expect(envelope.tokens.asphaltHalfWidth).toBeLessThan(envelope.tokens.kerbOuterOffset)
expect(envelope.surfaceAt(0.25, 0).classification).toBe('asphalt')
expect(envelope.isFootprintClear(illegalFootprint)).toBe(false)
\`\`\`

- [ ] **Step 2: Run test to verify it fails**

Run: \`npm test -- lib/spelling-race/world/trackEnvelope.test.ts\`

- [ ] **Step 3: Add immutable types and canonical cross-section implementation**

\`\`\`ts
export type TrackSurfaceSample = {
  point: THREE.Vector3; normal: THREE.Vector3; tangent: THREE.Vector3; right: THREE.Vector3
  classification: 'asphalt' | 'kerb' | 'runoff' | 'verge' | 'barrier' | 'outside'
  legalLateralBounds: readonly [number, number]
}
export function createTrackEnvelope(card: RouteCard): TrackEnvelope {
  return new TrackEnvelope(createRouteCurve(card), TRACK_ENVELOPE_TOKENS)
}
\`\`\`

- [ ] **Step 4: Implement transformed oriented-rectangle clearance and route validation rules**

\`\`\`ts
export function validateLandmarkClearance(card: RouteCard, envelope: TrackEnvelope): readonly string[] {
  return card.landmarks.flatMap((placement) => (
    envelope.isPlacementClear(placement) || !placement.required
      ? []
      : [\`required landmark \${placement.id} exceeds the safety envelope\`]
  ))
}
\`\`\`

- [ ] **Step 5: Run focused and existing route/placement tests**

Run: \`npm test -- lib/spelling-race/world/trackEnvelope.test.ts lib/spelling-race/world/routes.test.ts lib/spelling-race/world/placement.test.ts\`

- [ ] **Step 6: Commit**

\`\`\`bash
git add lib/spelling-race/world/types.ts lib/spelling-race/world/routes.ts lib/spelling-race/world/trackEnvelope.ts lib/spelling-race/world/trackEnvelope.test.ts
git commit -m "feat: define track safety envelope"
\`\`\`

### Task 2: Render non-overlapping road bands from the envelope

**Files:**
- Modify: \`components/spelling-race/world/track.ts\`
- Modify: \`components/spelling-race/world/materials.ts\`
- Modify: \`lib/spelling-race/world/railGeometry.test.ts\`
- Test: \`lib/spelling-race/world/trackEnvelope.test.ts\`

**Interfaces:**
- Consumes \`TrackEnvelope\` from Task 1.
- Produces \`TrackWorld { envelope, curve, root, halfWidth }\` and keeps \`sampleTrack\` delegating to \`envelope.surfaceAt\`.

- [ ] **Step 1: Write failing render-geometry tests for band ordering, closure, finite normals, and no driveable-band intersection**

\`\`\`ts
expect(readBand('track-kerbs')).not.toIntersect(readBand('track-asphalt'))
expect(allNormalsFinite(track.root)).toBe(true)
expect(track.envelope.surfaceAt(0.3, 0).point.y).toBeGreaterThanOrEqual(0)
\`\`\`

- [ ] **Step 2: Run focused geometry test**

Run: \`npm test -- lib/spelling-race/world/trackEnvelope.test.ts lib/spelling-race/world/railGeometry.test.ts\`

- [ ] **Step 3: Replace fixed-width strip/kerb/barrier arithmetic with envelope-derived meshes and safe instances**

\`\`\`ts
const sample = envelope.surfaceAt(progress, lateral)
matrix.compose(sample.point, orientationFrom(sample.tangent, sample.normal), scale)
\`\`\`

- [ ] **Step 4: Add cream/teal kerb material semantics and only authored edge/runoff markers**

- [ ] **Step 5: Update rail clearance tests to consume the production \`TrackEnvelope\` rather than reverse-engineering mesh polygons**

- [ ] **Step 6: Run tests and commit**

Run: \`npm test -- lib/spelling-race/world/trackEnvelope.test.ts lib/spelling-race/world/railGeometry.test.ts lib/spelling-race/world/sharedWorld.test.ts\`

\`\`\`bash
git add components/spelling-race/world/track.ts components/spelling-race/world/materials.ts lib/spelling-race/world/trackEnvelope.test.ts lib/spelling-race/world/railGeometry.test.ts
git commit -m "feat: render safe Singapore circuit bands"
\`\`\`

### Task 3: Make landmark placement sparse, legal, and non-blocking

**Files:**
- Modify: \`components/spelling-race/world/districts/index.ts\`
- Modify: \`components/spelling-race/world/districts/singaporeHeartland.ts\`
- Modify: \`components/spelling-race/TinyGrandPrixScene.tsx\`
- Modify: \`components/spelling-race/world/buildingLoader.ts\`
- Modify: \`lib/spelling-race/world/districts.test.ts\`
- Modify: \`lib/spelling-race/tinyGrandPrixScene.test.tsx\`

**Interfaces:**
- Consumes \`TrackWorld.envelope\` from Task 2 and \`validateLandmarkClearance\` from Task 1.
- Produces a district that contains only legal required landmarks plus limited optional background silhouettes.

- [ ] **Step 1: Write failing tests that renderer creation does not wait for building models and rejected optional placements are omitted**

\`\`\`tsx
root.render(<TinyGrandPrixScene {...sceneProps()} />)
expect(createRendererHost).toHaveBeenCalledOnce()
expect(district.getObjectByName('landmark-illegal-optional')).toBeUndefined()
\`\`\`

- [ ] **Step 2: Run focused tests**

Run: \`npm test -- lib/spelling-race/tinyGrandPrixScene.test.tsx lib/spelling-race/world/districts.test.ts\`

- [ ] **Step 3: Pass actual track world/envelope into district creation and validate every footprint before attach**

\`\`\`ts
createDistrictWorld(route, assets, palette, trackWorld, optionalBuildingModels)
\`\`\`

- [ ] **Step 4: Delete filler-clone expansion and eager catalogue path; load bounded optional silhouettes after renderer startup**

- [ ] **Step 5: Disable distant shadows and encode high/balanced/safe visibility counts**

- [ ] **Step 6: Run tests and commit**

Run: \`npm test -- lib/spelling-race/tinyGrandPrixScene.test.tsx lib/spelling-race/world/districts.test.ts lib/spelling-race/world/assets.test.ts\`

\`\`\`bash
git add components/spelling-race/world/districts components/spelling-race/TinyGrandPrixScene.tsx components/spelling-race/world/buildingLoader.ts lib/spelling-race/world/districts.test.ts lib/spelling-race/tinyGrandPrixScene.test.tsx
git commit -m "feat: keep Singapore scenery safe and sparse"
\`\`\`

### Task 4: Resolve kart presentation in track coordinates

**Files:**
- Create: \`lib/spelling-race/world/visualPose.ts\`
- Create: \`lib/spelling-race/world/visualPose.test.ts\`
- Modify: \`components/spelling-race/world/rendererHost.ts\`
- Modify: \`components/spelling-race/world/track.ts\`

**Interfaces:**
- Produces \`resolveVisualKartPoses(input): readonly VisualKartPose[]\`, where each pose has \`id\`, \`unwrappedProgress\`, and \`lateral\`.
- Renderer samples every returned pose through \`TrackEnvelope.surfaceAt\`.

- [ ] **Step 1: Write failing pure tests for circular wrap, coincident karts, chains, lane clamping, and minimum spacing**

\`\`\`ts
const poses = resolveVisualKartPoses({ player, rivals, lapLength: 1, legalLateralBounds: [-0.8, 0.8] })
expect(poses.every((pose) => pose.lateral >= -0.8 && pose.lateral <= 0.8)).toBe(true)
expect(minCircularGap(poses, 1)).toBeGreaterThanOrEqual(MINIMUM_PROGRESS_GAP)
\`\`\`

- [ ] **Step 2: Run test**

Run: \`npm test -- lib/spelling-race/world/visualPose.test.ts\`

- [ ] **Step 3: Implement deterministic visual-only progress/lane resolution with stable rival ordering**

- [ ] **Step 4: Remove \`resolveKartCollisions\`; place all karts using resolved poses and canonical surface normals**

- [ ] **Step 5: Run tests and commit**

Run: \`npm test -- lib/spelling-race/world/visualPose.test.ts lib/spelling-race/world/rendererSession.test.ts lib/spelling-race/raceSimulation.test.ts\`

\`\`\`bash
git add lib/spelling-race/world/visualPose.ts lib/spelling-race/world/visualPose.test.ts components/spelling-race/world/rendererHost.ts components/spelling-race/world/track.ts
git commit -m "fix: keep visual karts on legal track lanes"
\`\`\`

### Task 5: Build the semantic procedural gantry and separate HUD

**Files:**
- Create: \`components/spelling-race/world/gantry.ts\`
- Create: \`components/spelling-race/world/gantry.test.ts\`
- Modify: \`components/spelling-race/world/sharedWorld.ts\`
- Modify: \`components/spelling-race/world/rendererHost.ts\`
- Modify: \`components/spelling-race/GantryPrompt.tsx\`
- Modify: \`components/spelling-race/RaceHud.tsx\`

**Interfaces:**
- Produces \`createRaceGantry({ envelope, materials })\` and \`validateRaceGantry(gantry)\`.
- Required names: \`display_surface\`, \`display_top_left\`, \`display_top_right\`, \`display_bottom_left\`, \`display_bottom_right\`, \`sign_anchor\`, \`pylon_left_foot\`, \`pylon_right_foot\`, and named signal lamps.

- [ ] **Step 1: Write failing factory tests for semantic names, pylon clearance, and non-colour signal metadata**

\`\`\`ts
expect(validateRaceGantry(createRaceGantry(input))).toEqual([])
expect(gantry.getObjectByName('display_top_left')).toBeDefined()
expect(gantry.userData.signalState).toBe('listening')
\`\`\`

- [ ] **Step 2: Run test**

Run: \`npm test -- components/spelling-race/world/gantry.test.ts\`

- [ ] **Step 3: Implement teal pylons, charcoal truss, signal pods, and display surface from primitives**

- [ ] **Step 4: Use the factory in renderer host; retain simple procedural geometry fallback and make imported gantry optional**

- [ ] **Step 5: Change \`GantryPrompt\` to accessible word-only content and add bottom-centre turbo meter in \`RaceHud\`**

- [ ] **Step 6: Map countdown/listening/accepted/retry states to non-flashing reduced-motion variants; add 4.5:1 token tests**

- [ ] **Step 7: Run tests and commit**

Run: \`npm test -- components/spelling-race/world/gantry.test.ts lib/spelling-race/tinyGrandPrixScene.test.tsx lib/spelling-race/racePresentation.test.ts\`

\`\`\`bash
git add components/spelling-race/world/gantry.ts components/spelling-race/world/gantry.test.ts components/spelling-race/world/sharedWorld.ts components/spelling-race/world/rendererHost.ts components/spelling-race/GantryPrompt.tsx components/spelling-race/RaceHud.tsx
git commit -m "feat: embed word prompt in race gantry"
\`\`\`

### Task 6: Project the word screen and enforce tier policy

**Files:**
- Modify: \`components/spelling-race/world/rendererHost.ts\`
- Modify: \`components/spelling-race/world/visualDiagnostics.ts\`
- Modify: \`lib/spelling-race/world/quality.ts\`
- Modify: \`lib/spelling-race/world/quality.test.ts\`
- Modify: \`lib/spelling-race/world/visualDiagnostics.test.ts\`

**Interfaces:**
- Produces \`projectGantryDisplay(corners, camera, viewport)\` returning DOM bounds or \`null\`.
- Extends \`QualityProfile\` with named visibility/shadow policy rather than only DPR and particles.

- [ ] **Step 1: Write failing projection tests for four-corner fit, behind-camera rejection, viewport clipping, and proxy occlusion**

\`\`\`ts
expect(projectGantryDisplay(corners, camera, viewport)).toMatchObject({ left: expect.any(Number), width: expect.any(Number) })
expect(projectGantryDisplay(hiddenCorners, camera, viewport)).toBeNull()
\`\`\`

- [ ] **Step 2: Run test**

Run: \`npm test -- lib/spelling-race/world/visualDiagnostics.test.ts\`

- [ ] **Step 3: Project four display corners, fit DOM transform/size, and raycast only explicit gantry-screen occluder proxies**

- [ ] **Step 4: Define high/balanced/safe matrices for shadows, silhouettes, marker density, lamps, and particles; apply them in renderer/districts**

- [ ] **Step 5: Add diagnostics budgets for calls, triangles, textures, shadow casters, and tier policy**

- [ ] **Step 6: Run tests and commit**

Run: \`npm test -- lib/spelling-race/world/quality.test.ts lib/spelling-race/world/visualDiagnostics.test.ts lib/spelling-race/world/rendererSession.test.ts\`

\`\`\`bash
git add components/spelling-race/world/rendererHost.ts components/spelling-race/world/visualDiagnostics.ts lib/spelling-race/world/quality.ts lib/spelling-race/world/quality.test.ts lib/spelling-race/world/visualDiagnostics.test.ts
git commit -m "feat: fit gantry display and enforce scene tiers"
\`\`\`

### Task 7: Complete visual regression, device-budget, and release verification

**Files:**
- Modify: \`public/spelling-race/assets/manifest.json\`
- Modify: \`README.md\`
- Modify: relevant tests under \`lib/spelling-race/world/\`
- Create: \`docs/superpowers/verification/2026-08-13-singapore-street-grand-prix.md\`

**Interfaces:**
- Records target device/Safari version and measured high/balanced/safe scene budgets.
- Retains checkpoint screenshot paths and reviewer results.

- [ ] **Step 1: Add failing visual-debug budget assertions using versioned manifest limits**

\`\`\`ts
expect(diagnostics.calls).toBeLessThanOrEqual(limits.high.calls)
expect(diagnostics.shadowCasters).toBeLessThanOrEqual(limits.safe.shadowCasters)
\`\`\`

- [ ] **Step 2: Run the harness and collect baseline failures before changing limits**

Run: \`npm test -- lib/spelling-race/world/visualDiagnostics.test.ts\`

- [ ] **Step 3: Capture void-deck, hawker, and rail checkpoints at desktop and iPad-like aspect ratios; store sheets in \`docs/assets/\`**

- [ ] **Step 4: On the selected physical iPad Safari, measure startup transfer/usable-scene time and 10-second p50/p95 frame times for every tier**

- [ ] **Step 5: Update manifest budgets only from measured device results; record device, Safari, commands, screenshots, and pass/fail evidence**

- [ ] **Step 6: Run full verification**

Run: \`npm test && npm run lint && npm run build\`

- [ ] **Step 7: Commit**

\`\`\`bash
git add public/spelling-race/assets/manifest.json README.md docs/assets docs/superpowers/verification lib/spelling-race/world
git commit -m "test: verify Singapore street race visuals"
\`\`\`

## Plan self-review

- Spec coverage: Tasks 1-2 implement the canonical envelope, crown, bands, and markers; Task 3 removes the iPad-hostile scenery path; Task 4 fixes visual kart separation; Tasks 5-6 implement the gantry, accessible HUD, projection, and tier policy; Task 7 makes visual evidence and physical-device budgets durable.
- Placeholder scan: no \`TODO\`, \`TBD\`, or deferred implementation steps remain.
- Type consistency: \`TrackEnvelope\` is introduced before every consumer; \`TrackWorld.envelope\` is the geometry/placement interface; \`VisualKartPose\` is renderer-only; gantry semantic names are defined before projection use.
