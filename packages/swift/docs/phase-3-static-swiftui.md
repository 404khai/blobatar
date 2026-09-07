# Phase 3 — static SwiftUI rendering

Status: accepted
Date: 2026-09-07
Reference: Blobatar `2.4.0`, generation 2

Phase 3 presents the immutable Phase 2 drawing through native SwiftUI vector
primitives. It does not parse SVG, rasterize ahead of time, recalculate core
geometry, or introduce expression and animation behavior reserved for later
phases.

## External seam

The SwiftUI module adds one public view:

```swift
Blobatar(
  name: "alain",
  size: 64,
  options: BlobatarOptions(background: .squircle),
  accessibilityLabel: "Avatar of Alain"
)
```

`size` pins a square edge when supplied. With no size, the view accepts its
parent's flexible proposal. In either mode the renderer maps the core's
100-by-100 coordinate system into the largest centered square, preserving its
aspect ratio under non-square constraints.

`BlobatarOptions` crosses this seam unchanged. The presentation module adds no
defaults or visual decisions. Reconstructing a view with a different name or
options selects a different cached rendering; reconstructing it with the same
inputs reuses both the resolved core drawing and its converted SwiftUI paths.

## Native rendering

Every core path segment is converted at full precision to the corresponding
SwiftUI `Path` operation. Horizontal and vertical segments become line
operations at the tracked current coordinate, and closing a contour restores
its subpath start. Rounded SVG serialization remains solely a core parity
assertion and never enters the renderer.

One `Canvas` fills the cached paths in the reference stacking order:

1. backdrop
2. petals
3. extra marks
4. body
5. eyes

Colors accept the core contract's `#rrggbb` output and palette overrides. The
renderer does not introduce a fallback color because that would create a new
visual default outside the generation-2 contract.

The cache key contains the name and every option value, including ordered
narrowed-trait values and dictionary-order-independent trait names. A bounded,
thread-safe cache shares immutable renderings across ordinary SwiftUI value
reconstruction without turning the renderer into mutable view state.

## Accessibility

The complete figure is one accessibility element with the image trait, rather
than exposing its body and eyes as meaningless children. A supplied
`accessibilityLabel` names that element. When no label is supplied, it remains
an explicitly unlabeled image: the deterministic seed is not treated as user
facing speech and no synthetic "avatar" label is invented.

## Verification boundary

Tests assert segment-kind preservation, exact square-path coordinates,
100-by-100 bounds, fixed and flexible size configuration, centered wide and
tall viewports, all four backdrop modes, layer order, cache reuse, name and
option invalidation, option forwarding, and labeled versus unlabeled image
semantics. The public package-consumer fixture also constructs the view.

Representative AppKit-hosted raster snapshots verify deterministic Canvas
output, seed-dependent pixels, transparent non-square margins, and the
resolved backdrop, head, and eye colors. Geometry and layer assertions are the
primary parity gate. Raster probes use only three-by-three interior regions and
permit a maximum `2/255` difference per color channel for Core Graphics color
conversion and antialiasing; no path-coordinate tolerance is applied.

This phase changes no TypeScript or Flutter source, does not edit either
reference fixture, and does not change the generation-2 seed-to-look mapping.
