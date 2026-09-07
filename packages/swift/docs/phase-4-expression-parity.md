# Phase 4 — expression parity

Status: accepted
Date: 2026-09-07
Reference: Blobatar `2.4.0`, generation 2

Phase 4 adds the fourteen authored generation-2 expressions to the native core
and makes the static SwiftUI view render their exact endpoints. Expressions do
not add marks, change silhouette selection, or consume another seeded trait.

## External seam

`BlobatarExpression` is a public, closed value roster:

```swift
BlobatarOptions(expression: .thinking)
```

The cases are `idle`, `happy`, `sad`, `mad`, `surprised`, `wink`, `sleepy`,
`smug`, `unsure`, `scared`, `love`, `shy`, `sick`, and `thinking`. The pose
channels and tint-target machinery remain core implementation details; callers
select a semantic expression without having to coordinate eye transforms,
body translation, or palette math themselves.

The existing `resolveBlobatar(_:options:)` interface remains the only core
operation. Its drawing now includes `bodyOffsetY`, the rigid translation that
renderers apply to the complete figure while leaving the backdrop fixed.
Omitting `expression` and supplying `.idle` return exactly equal drawings.

## Pose composition

The core applies every authored channel in one composition:

- shared eye width, height, tilt, vertical position, and separation;
- second-eye width, height, tilt, and vertical differentials;
- progressive cancellation of each eye's seeded lean through the lock value;
- rigid whole-figure vertical offset;
- heat, shake, and rock values retained for the elapsed-time phase.

The second-eye values are differentials rather than replacement endpoints.
Tilt and horizontal offset mirror by eye side. Static eye paths are regenerated
from the composed eye geometry, while petals, extra marks, and the body retain
their resolved geometry and share the rigid body offset in the SwiftUI render
plan. This is the same composition the animated endpoints will consume in
Phase 6.

## Palette tinting

`mad`, `love`, `shy`, and `sick` derive hot, rose, blush, and bile targets from
the palette the figure is actually wearing, including explicit overrides. The
core decodes serialized sRGB into OKLCh, derives a per-figure target, enforces
the dark-surface and eye-to-head floors, verifies eleven points along the
serialized OKLab mix, and finally applies the expression's heat amount.

Only head and eye colors move. The background role—and therefore any backdrop
plate—remains unchanged. Invalid palette override notation continues to fail
the renderer contract rather than silently introducing a fallback color.

## Verification boundary

The canonical TypeScript fixture contains 42 expression cases: every roster
value over representative round, organic, and triangle figures. Swift tests
compare all fourteen pose records exactly, every composed eye coordinate at the
fixture's documented `1e-9` relative tolerance, every rounded eye and body path
exactly, every palette hex exactly, and every rigid body offset exactly.

Independent checks prove that omitted and idle drawings are equal across 200
names, second-eye differentials remain one-sided, lock behavior replaces the
seeded lean, tinting retains at least `4.5:1` eye-to-head contrast, and all
expressions keep their paths in frame and eyes separated across 800 names.
SwiftUI checks also prove expression changes invalidate the rendering cache and
that the cached static render plan applies body offset outside the backdrop.

This phase changes no TypeScript or Flutter source, does not edit either
reference fixture, and does not change the generation-2 seed-to-look mapping.
