# Singapore Street Grand Prix visual design

## Goal

Turn the race scene into a clear, lively, child-friendly Singapore street circuit. The road must read as the safest and most important thing on screen; the word gantry must feel like a real part of the course; scenery must frame the race without visually or physically colliding with it.

## Scope

This design changes the Three.js race-world presentation only: track geometry and materials, roadside placement, gantry presentation, kart separation, asset loading, and visual verification. The word/voice game loop, route theme, car selection, and quality-tier framework remain in place.

## Chosen visual direction

**Singapore Street Grand Prix** is a warm late-afternoon circuit with charcoal asphalt, cream-and-teal kerbs, teal-and-charcoal gantries, coral/yellow karts, and tropical greenery. Its design language is compact and celebratory rather than realistic-simulation-heavy.

The intended composition is represented by the two approved concept mockups:

- [race view](../../assets/singapore-street-grand-prix-race-view.png)
- [gantry/detail view](../../assets/singapore-street-grand-prix-gantry-view.png)

The game will not copy their photorealistic finish. It will reproduce their hierarchy, proportions, materials, and spatial safety in the existing stylised Three.js art direction.

## Architecture

### Track envelope

`TrackWorld` owns one sampled `TrackEnvelope` contract. It uses named tokens for the driveable half-width, kerb width, runoff width, verge width, barrier width, barrier setback, scenery safety margin, and crown height. A canonical cross-section function accepts route progress and lateral offset and returns surface position, normal, tangent, right vector, road classification, and lateral bounds.

The circuit becomes a set of non-overlapping, spline-derived bands. Each band follows the same route curve so it remains consistent through all bends:

1. driveable asphalt;
2. raised alternating cream/teal kerbs;
3. narrow painted edge or localised runoff;
4. grass/concrete verge;
5. crash barrier;
6. landmark/scenery clearance zone.

Road meshes, kerbs, barriers, karts, camera targets, gantry footings, and effects all sample this same cross-section function. This prevents a crowned road from leaving objects floating or embedded. The road gains painted edge lines, corner apex highlights, a restrained racing-line texture/decal, and turn-arrow/braking-marker instances at authored turn metadata; each marker has a route progress, side, and quality-tier visibility rule.

`TrackEnvelope` exposes `surfaceAt`, legal kart bounds, barrier boundaries, and footprint-clearance queries. Scenery can never be placed inside the barrier-clearance boundary. Every landmark asset declares a conservative local oriented-rectangle footprint and visual priority; scale and yaw are applied before its swept world-space footprint is checked against the outer safety envelope through bends. Optional placements may move outward no more than a named offset or be omitted. Required placements fail route validation when no legal placement exists. District construction receives the actual `TrackWorld`; it does not recreate a separate route curve.

### Scenery and performance

The current filler-building strategy is removed entirely, and the race path no longer eagerly loads the catalogue of building GLBs. Each zone instead receives one primary Singapore landmark and a small number of intentionally spaced, curated background silhouettes. These assets load asynchronously after the playable scene becomes available. Near-corner scenery is low and readable; tall buildings are backdrops, do not cast shadows, and are removed first at lower tiers.

Repeated kerbs, barriers, braking boards, trees, and small crowd/seat elements use `THREE.InstancedMesh`; static repeated geometry is merged by material when instancing is unsuitable. Imported GLBs remain the source for distinctive HDB, shophouse, rail, and kart assets.

Performance is gated on a physical target iPad running its current supported Safari, with a fixed device class recorded before implementation. The first implementation baseline and tier budgets must define transfer bytes, first usable scene time, p50/p95 frame time, render calls, visible triangles, texture count, and shadow-caster count. The safe tier disables nonessential shadows as well as distant silhouettes and secondary decoration; an iPad-like Chromium viewport is layout-only verification, not performance evidence.

### Gantry and HUD

The canonical gantry is a parameterised procedural Three.js factory, with its width derived from `TrackEnvelope` barrier boundaries. The existing GLB becomes optional and is not required to start the renderer. The factory contains named semantic parts:

- two teal pylons outside the barriers;
- a charcoal open truss and slim rounded canopy;
- two three-light signal pods;
- a central framed `display_surface`, four display-corner anchors, and `sign_anchor` on its physical screen;
- named pylon footing anchors and signal-pod/lamp assemblies.

The factory validates all semantic nodes before use. If it fails, the old simple procedural gantry remains visible and the word prompt is hidden rather than detached. The word prompt remains accessible DOM text, but the four display corners are projected each frame and used to fit it precisely to the display recess. It is hidden if behind the camera, outside the viewport, or blocked by a small explicit occluder-proxy raycast; it is not raycast against the full scene. The turbo meter moves to a stable bottom-centre HUD, separate from the word prompt.

Signal states are explicit: countdown uses left-to-right lamp positions; listening uses a steady centre listening icon; accepted uses a check-shaped display treatment; retry/idle uses a pause-shaped display treatment. Each state has a reduced-motion equivalent without flashing. Text/background token pairs are defined and tested to meet 4.5:1 contrast. Every essential state has a position, shape, or icon cue in addition to colour.

### Kart placement and separation

Kart pose begins and ends in renderer-owned visual track coordinates: unwrapped route progress plus lateral lane position. Rival lanes have reserved centres and minimum circular longitudinal spacing. When two karts approach, the visual-pose resolver adjusts progress and lane separation, then resamples `TrackEnvelope.surfaceAt` and clamps each kart to the driveable surface. It does not push meshes in arbitrary world X/Z directions. Race ranking simulation remains authoritative; yielding changes visual pose only unless a later gameplay design explicitly opts into simulation-speed changes.

This makes collisions legible, prevents barrier clipping, and keeps the camera, particles, and road contact aligned. Visual overlap can be softened with a brief lateral nudge or speed-yield; this is not a physics simulation.

## Data flow

`RouteCard` retains route points and landmarks, adding footprint, priority, and authored corner-marker metadata. `createTrackWorld` derives all road bands and exposes `TrackEnvelope`. District construction asks its supplied envelope whether a transformed landmark footprint is legal before attaching it. Renderer maps race state to legal visual track coordinates, then updates the physical gantry, DOM word screen, camera, and effects from those coordinates.

## Error handling and fallback

- A missing optional landmark or one that cannot fit safely remains non-fatal and leaves a deliberate empty background area.
- A required landmark that cannot fit safely fails route validation with its footprint and conflicting envelope section in the error.
- If the gantry factory fails validation, retain the simple procedural gantry but hide the projected prompt rather than show it detached from a physical surface.
- At lower quality tiers, retain road edge, gantry, karts, safety barriers, and direction markers; remove distant silhouettes, nonessential shadows, then secondary decoration in that order.
- Reduced-motion mode retains clear markers and word display while suppressing boost particles, speed streaks, and display/lamp animations.

## Testing and visual verification

### Unit tests

- Track bands have correct ordering, seam closure, finite normals, consistent winding, and no intersection with the driveable lane.
- Every transformed landmark footprint respects the swept track safety envelope; required invalid placements fail route validation.
- Kart visual-pose resolution always returns legal road coordinates, handles coincident centres and chains, and maintains minimum separation.
- Gantry factory validates its semantic nodes; four-corner DOM projection fits the physical screen and hides when behind the camera, outside viewport, or its occluder proxy is hit.
- Every signal state has its specified non-colour treatment; computed text/UI token pairs meet 4.5:1 contrast.
- Quality tiers preserve mandatory readability elements and satisfy their stated scene budgets.

### Visual checkpoints

Capture the current development checkpoints—void-deck grid, hawker sweep, and rail/shophouse turn—at desktop and iPad-like aspect ratios, and retain the comparison sheets in the repository. Review for:

- continuous, uncluttered forward sightline through each bend;
- no scenery, barrier, or rival visibly intersecting the driveable road;
- gantry word screen visibly embedded inside its frame;
- road edges and markers distinguishable without relying on a single colour;
- measured device frame time and scene budget compliance on every tier.

## Success criteria

- The player can identify the road edge and the next turning direction at a glance.
- No shipping landmark intersects the road, kerb, or safety verge.
- Karts never visibly clip through one another or leave the legal track envelope after separation.
- The word appears to belong to the gantry, with the turbo meter clearly separated into the HUD.
- High-contrast text/UI meets a minimum 4.5:1 contrast ratio against its immediate background; essential signals also have non-colour differentiation.
- The visual upgrade meets the versioned device/tier performance budget introduced with this work.

## Non-goals

- Full rigid-body vehicle physics or damage.
- Photorealism, a new rendering engine, or a wholesale asset-library replacement.
- Automatically generating final environment art from a single concept image.

## Asset strategy

`img2threejs` may be used as a gated visual blockout for the gantry from an isolated, clean three-quarter reference, but the final shipping gantry is hand-authored procedural Three.js. A blockout must explicitly expose `display_surface`, display corners, `sign_anchor`, pylons, signal pods/lamps, truss, canopy, and footing anchors, and must pass primitive/material, triangle, shadow-caster, and width-fit budgets before it informs the final factory. It is not appropriate for the whole circuit, terrain, foliage, repeating road system, or the existing GLB-based landmark library. Those are better represented by reusable procedural track bands, instancing, and curated GLBs.
