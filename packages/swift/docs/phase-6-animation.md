# Phase 6 — elapsed-time animation

Status: accepted
Date: 2026-09-07
Reference: Blobatar `2.4.0`, generation 2

Phase 6 adds deterministic motion arithmetic to `BlobatarCore` and a
lifecycle-aware `AnimatedBlobatar` to `BlobatarSwiftUI`. The core interface is
one value-oriented seam: `BlobatarAnimationModel` owns cached base geometry,
seeded clocks, expression endpoints, interpolation, and frame evaluation. A
renderer receives affine transforms and two finished colors; the seeded trait
draws, pose roster, wrap tables, easing solver, and tint interpolation remain
hidden inside the module.

## Reference vectors

`tools/export-reference-vectors.ts` now exports four representative motion
requests, 24 fixed elapsed-time frames, and interruption-relevant pose/tint
morph samples. Generation, palette, layout, and static-expression data still
come from the detached `2.4.0` source tree. Motion samples come from the
TypeScript arithmetic evaluator introduced by the stacked Flutter workstream,
which is a direct evaluation of that release's `motion.css`. The canonical and
Flutter fixture copies remain byte-identical.

Swift parity tests decode those generated values. No expected seed, frame,
easing, pose, or color number is copied into the Swift assertions.

## Core motion model

The model derives independent breathe, bob, blink, and saccade phases from the
same keyed trait streams as the web implementation. A frame evaluates those
loops from an absolute elapsed millisecond value, including blink easing,
saccade holds, secondary-eye wrap, the thinking seesaw, and expression tremor.
Expression states are opaque interpolation endpoints, allowing a new morph to
begin at the currently visible pose and tint without exposing the pose roster
to SwiftUI.

All paths in `model.drawing` are unposed base geometry. Per-frame values are
affine transforms for the root, hover response, breathing, body offset, eye
pair, pose, and gaze layers. This keeps path construction off the timeline.

## SwiftUI lifecycle

`AnimatedBlobatar` uses a pausable `TimelineView` and samples
`ProcessInfo.systemUptime`, giving every instance one shared monotonic clock
without accumulating frame deltas. `.hover` sleeps after its ramps settle;
`.always`, held tremor, and held thinking seesaw continue sampling. The public
`active` input stops off-screen rows explicitly. An inactive scene or Reduce
Motion preference switches to the exact static `Blobatar` endpoint, removes the
continuous timeline, and settles pending state.

Identity and geometry-option changes cut because paths cannot safely morph.
Expression-only changes reuse the cached base drawing and interpolate over 300
milliseconds when entering an expression or 400 milliseconds when returning to
idle. Hover lift uses its separate 220/160 millisecond enter/exit timings, while
ambient amplitude ramps over 400 milliseconds.

## Verification boundary

Core tests cover every exported frame and morph sample, independent phase
streams, saccade holds, blink/wrap bounds, and static starting values. SwiftUI
tests cover directional hover and ambient ramps, interrupted morphs, identity
cuts, explicit/scene/reduced-motion inactivity, expression reuse, and a
twelve-figure crowd sampled for 120 frames without another geometry resolution.
The external consumer smoke imports and constructs the public animated view and
evaluates a public motion frame.

This phase does not alter normalization, hashing, traits, silhouette geometry,
palette endpoints, or the expression roster. For a fixed name and options, the
seed-to-look mapping remains generation-2 `2.4.0`.
