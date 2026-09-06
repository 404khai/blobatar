# Phase 2 — deterministic Swift core

Status: accepted
Date: 2026-09-06
Reference: Blobatar `2.4.0`, generation 2

Phase 2 implements the frozen seed-to-look calculation in `BlobatarCore`
without importing SwiftUI or Core Graphics. It does not render pixels and it
does not implement expressions or elapsed-time motion.

## External seam

The core module exposes one operation:

```swift
resolveBlobatar(_:options:) -> BlobatarDrawing
```

`BlobatarOptions` groups palette, hue, tone, normalization, contrast,
backdrop, and trait inputs. Trait values use `BlobatarTraitOverride.pinned`
or `.narrowed`; the public interface never accepts `[String: Any]`.

`BlobatarDrawing` is an immutable and `Sendable` value containing the selected
silhouette, fitted body and eye geometry, structured paths, palette, and
optional backdrop. Its constituent output values are also equatable and
hashable, so renderers can cache a resolved figure without inventing a second
identity rule.

Hash states, trait readers, color-space conversion, shape definitions, and
containment arithmetic remain implementation details. They are not public
calculation functions merely to make parity tests convenient. This keeps the
module deep: callers provide a name and options and receive the complete
figure without learning the order or ranges of its internal decisions.

## Compatibility details

- Seed normalization performs NFC, ECMAScript whitespace trimming, and the
  JavaScript full lowercase behavior pinned by the international vectors.
- Seed length uses UTF-16 code units while hash input uses UTF-8 bytes, matching
  JavaScript's `String.length` and `TextEncoder` combination.
- Hash arithmetic uses wrapping unsigned 32-bit operations; fixture states are
  compared through their signed JavaScript view.
- Every trait is derived from its own keyed stream. Adding a new key therefore
  cannot consume or shift an existing decision.
- Pinned and narrowed values clamp to `[0, 0.999999]`; negative values and NaN
  become zero, and empty narrowed lists behave like omitted keys.
- Palette output is resolved through OKLCh, chroma gamut reduction, authored
  half-open tone bands, and the frozen contrast chain before hexadecimal
  serialization.
- Paths remain structured values. Exact SVG-style path serialization exists
  internally only as a parity assertion and is not a promised SVG-output
  feature.

## Verification boundary

The Swift suite consumes the checked-in TypeScript reference artifact
read-only. It verifies every hash state and stream, every override case, all
112 palette vectors, and all 1,570 base layout cases. Shape names, palette
hexes, and rounded path strings compare exactly. Only unrounded trigonometric
layout coordinates use the fixture's documented `1e-9` relative tolerance.

Independent sweeps additionally check frame, face, body, eye-separation, and
decoration-attachment invariants across 6,000 names and hundreds of extreme or
pseudorandom trait maps. These checks do not derive their expectations from
the fixture.

The expression vectors remain reserved for Phase 4. Motion remains reserved
for Phase 6. This phase changes no TypeScript or Flutter source, does not edit
either reference fixture, and does not change the generation-2 seed-to-look
mapping.
