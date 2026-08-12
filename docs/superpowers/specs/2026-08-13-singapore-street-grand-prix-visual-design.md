# Singapore Street Grand Prix visual design

## Goal

Turn the race scene into a clear, lively, child-friendly Singapore street circuit. The road must read as the safest and most important thing on screen; the word gantry must feel like a real part of the course; scenery must frame the race without visually or physically colliding with it.

## Scope

This design changes the Three.js race-world presentation only: track geometry and materials, roadside placement, gantry presentation, kart separation, and visual verification. The word/voice game loop, route theme, existing GLB loading, car selection, and quality-tier framework remain in place.

## Chosen visual direction

**Singapore Street Grand Prix** is a warm late-afternoon circuit with charcoal asphalt, cream-and-teal kerbs, teal-and-charcoal gantries, coral/yellow karts, and tropical greenery. Its design language is compact and celebratory rather than realistic-simulation-heavy.

The intended composition is represented by the two approved concept mockups:

- race view: `exec-f6d9dceb-06b9-42ef-9554-5d51cbd38d9d.png`
- gantry/detail view: `exec-ad82d91c-eb70-4dea-a797-7c735f8c2e26.png`

The game will not copy their photorealistic finish. It will reproduce their hierarchy, proportions, materials, and spatial safety in the existing stylised Three.js art direction.

## Architecture

### Track envelope

The circuit becomes a set of concentric, spline-derived bands. Each band follows the same route curve so it remains consistent through all bends:

1. driveable asphalt;
2. raised alternating cream/teal kerbs;
3. narrow painted edge or localised runoff;
4. grass/concrete verge;
5. crash barrier;
6. landmark/scenery clearance zone.

`TrackWorld` owns these bands and exposes a clearance calculation for all route placements. The width of each band is expressed as a named design token, not repeated arithmetic. The road gains a small cross-section crown, painted edge lines, corner apex highlights, a restrained racing-line texture/decal, and turn-arrow/braking-marker instances where visibility needs help.

Scenery can never be placed inside the barrier-clearance boundary. Placement validation uses an asset's horizontal footprint plus a fixed safety margin. A rejected placement is moved outward or omitted; it is never allowed to overlap the road simply because a model is visually attractive.

### Scenery and performance

The current dense filler-building strategy is removed from the immediate circuit edge. Each zone instead receives one primary Singapore landmark and a small number of intentionally spaced background silhouettes. Near-corner scenery is low and readable; tall buildings are backdrops.

Repeated kerbs, barriers, braking boards, trees, and small crowd/seat elements use `THREE.InstancedMesh`; this preserves the existing low draw-call approach and keeps the visual upgrade viable on the target iPad hardware. Imported GLBs remain the source for distinctive HDB, shophouse, rail, and kart assets.

### Gantry and HUD

The imported gantry is replaced or refactored into a named Three.js assembly:

- two teal pylons outside the barriers;
- a charcoal open truss and slim rounded canopy;
- two three-light signal pods;
- a central framed display recess with a `sign_anchor` on its physical screen.

The word prompt remains accessible DOM text, but its projected bounds match the display recess with a conservative maximum width and proper depth/viewport clipping. It is styled as content inside the screen rather than a floating card. The turbo meter moves to a stable bottom-centre HUD, separate from the word prompt. Signal lamps and the display surface provide distinct non-colour state cues (lamp position/pattern and icon/shape, in addition to hue).

### Kart placement and separation

Kart pose begins and ends in track coordinates: route progress plus lateral lane position. Rival lanes have reserved centres and minimum longitudinal spacing. When two karts approach, the resolver adjusts track-coordinate separation, then resamples the spline and clamps each kart to the driveable surface. It does not push meshes in arbitrary world X/Z directions.

This makes collisions legible, prevents barrier clipping, and keeps the camera, particles, and road contact aligned. Visual overlap can be softened with a brief lateral nudge or speed-yield; this is not a physics simulation.

## Data flow

`RouteCard` retains route points and landmarks, adding only placement metadata needed to express scenery footprint and visual priority. `createTrackWorld` derives the road bands and exposes its bounds. District construction asks the track envelope whether a landmark is legal before attaching it. Renderer updates map race state to legal track coordinates, then update the physical gantry, DOM word screen, camera, and effects from those coordinates.

## Error handling and fallback

- A missing optional landmark remains non-fatal and leaves a deliberate empty background area.
- If the new gantry model/assembly fails validation, retain the existing simple procedural gantry but hide the projected prompt rather than show it detached from a physical surface.
- At lower quality tiers, retain road edge, gantry, karts, and safety barriers; remove distant silhouettes and secondary decoration first.
- Reduced-motion mode retains clear markers and word display while suppressing boost particles, speed streaks, and display/lamp animations.

## Testing and visual verification

### Unit tests

- Every landmark footprint respects the track safety envelope at every route progress point.
- Kerb, verge, barrier, and scenery bands have no overlap with the driveable lane.
- Kart resolution always returns positions within road bounds and maintains minimum separation.
- Gantry display projection is hidden when behind the camera, outside viewport, or its physical screen is occluded.
- Quality tiers preserve the mandatory readability elements.

### Visual checkpoints

Capture the current development checkpoints—void-deck grid, hawker sweep, and rail/shophouse turn—at desktop and iPad-like aspect ratios. Review for:

- continuous, uncluttered forward sightline through each bend;
- no scenery, barrier, or rival visibly intersecting the driveable road;
- gantry word screen visibly embedded inside its frame;
- road edges and markers distinguishable without relying on a single colour;
- stable frame time and no draw-call regression on the high tier.

## Success criteria

- The player can identify the road edge and the next turning direction at a glance.
- No shipping landmark intersects the road, kerb, or safety verge.
- Karts never visibly clip through one another or leave the legal track envelope after separation.
- The word appears to belong to the gantry, with the turbo meter clearly separated into the HUD.
- High-contrast text/UI meets a minimum 4.5:1 contrast ratio against its immediate background; essential signals also have non-colour differentiation.
- The visual upgrade stays within existing quality-tier performance budgets.

## Non-goals

- Full rigid-body vehicle physics or damage.
- Photorealism, a new rendering engine, or a wholesale asset-library replacement.
- Automatically generating final environment art from a single concept image.

## Asset strategy

`img2threejs` is appropriate for a one-off hard-surface hero object—especially the custom gantry—if we provide a clean orthographic/three-quarter reference and accept procedural TypeScript output after its quality gates. It is not appropriate for the whole circuit, terrain, foliage, repeating road system, or the existing GLB-based landmark library. Those are better represented by reusable procedural track bands, instancing, and curated GLBs.
