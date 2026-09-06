# Phase 0 — Swift port contract and distribution freeze

Status: accepted
Date: 2026-09-06
Branch: `feat/swift-port`

This record freezes the initial contract for the native Swift and SwiftUI port
before production Swift source is added. It follows the Dart and Flutter port's
proven structure while accounting for Swift Package Manager's Git-based
distribution model.

## Identity and scope

The **Swift SDK** is a native reimplementation of Blobatar's deterministic
generation-2 contract. It is not a JavaScript framework adapter: it owns a
Swift implementation of normalization, hashing, traits, color, geometry,
expressions, and elapsed-time motion. It will not execute JavaScript, parse the
library's SVG output, contact the endpoint, or embed a web view.

The **SwiftUI module** is the presentation module inside that SDK. It adds no
shape vocabulary, geometry, trait behavior, palette rules, expressions, or
visual defaults. It resolves all figures through the Swift core and changes
only how the resulting drawing model reaches an Apple display.

The **Blobatar Studio** is the example iOS and macOS SwiftUI application. It is
an integration consumer, not part of the SDK's public library products, and it
may use only their public interfaces.

## Frozen parity reference

The initial Swift SDK targets Blobatar `2.4.0`, generation 2, because that is
the released source used to produce the existing checked-in reference vectors
and the contract already proven by the Dart and Flutter implementation.

The repository is currently at Blobatar `2.7.0`. That does not move the frozen
generation-2 seed-to-look mapping. Features added after `2.4.0` are evaluated
separately from that mapping; pointer gaze is the known example and is deferred
from the initial Swift release.

The TypeScript implementation at the pinned release remains the source of
truth. Swift and Dart consume byte-identical generated reference data
read-only. The Swift branch does not relocate or edit the Flutter fixture;
while both workstreams exist in one checkout, the Swift harness proves the two
copies agree. Neither implementation may write expected output from itself,
loosen its comparison rules, or edit an existing TypeScript golden to make a
port pass.

Exact parity is required for normalized strings, hash states, trait streams,
silhouette names, palette hex values, expression channels, and rounded path
strings. The existing `1e-9` relative tolerance applies only to documented
trigonometric layout values where standard math libraries may differ at the
last bit.

## Package layout

All Swift-specific source, tests, example application files, fixtures that are
not shared across languages, and package documentation live under
`packages/swift`:

```text
packages/swift/
├── Sources/BlobatarCore/
├── Sources/BlobatarSwiftUI/
├── Tests/BlobatarCoreTests/
├── Tests/BlobatarSwiftUITests/
├── Examples/BlobatarStudio/
└── docs/
```

The deliberate repository-root integration points are:

- `Package.swift`, because the repository's Git URL is the Swift package URL.
- `.github/workflows/ci.yml`, because CI is repository-owned.
- `README.md` and `CONTRIBUTING.md`, when the finished SDK becomes a documented
  repository surface.
- A language-neutral fixture location, which Phase 1 populates from the pinned
  reference bytes without changing the separate Flutter workstream.

A manifest only inside `packages/swift` is rejected for the public package. It
would be pleasant for local browsing but would not present the repository root
as the package consumers add by URL. The root manifest will keep target paths
pointing into `packages/swift`, preserving one development tree without moving
implementation files to the root.

## Module seams

The package exposes two library targets:

- `BlobatarCore`: deterministic calculation and immutable drawing values,
  without SwiftUI or Core Graphics dependencies.
- `BlobatarSwiftUI`: static and animated SwiftUI views backed by the core.

The external core seam is one operation that resolves a name and options into
an immutable drawing model. Additional public calculation functions are added
only where a real non-UI caller needs them; parity tests do not justify making
implementation details public.

The SwiftUI module consumes that drawing model directly. No renderer protocol
is introduced for the initial release because only one native renderer exists.
A UIKit, AppKit, image-export, or other second implementation would make that a
real seam and is the point at which an adapter interface should be considered.

## Initial feature set

The initial release includes:

- NFC, trim, and lowercase normalization.
- JavaScript-compatible deterministic hashing and keyed trait streams.
- Pinned and narrowed trait overrides.
- The ten generation-2 silhouettes and their frozen bands.
- OKLCh palette resolution, authored tone bands, contrast, and overrides.
- None, square, circle, and squircle backdrops.
- All fourteen expressions and their palette tints.
- Static SwiftUI rendering.
- Seeded breathe, bob, blink, saccade, and secondary-eye wrap motion.
- Expression morphing, thinking seesaw, and tremor channels.
- Hover and always-on ambient modes where the input platform supports them.
- System reduced-motion behavior and explicit activity control.
- An iOS and macOS Blobatar Studio example.

The initial release excludes:

- SVG markup and data-URI output.
- Network or endpoint access.
- UIKit and AppKit view types.
- PNG or file export.
- Pointer gaze, which is planned as an optional later phase.
- Android, Linux UI, Windows UI, and WebAssembly rendering.

## Supported platforms and toolchains

The initial supported UI platforms are iOS 15 or later and macOS 12 or later.
Those floors provide the SwiftUI canvas and animation-timeline model selected
for the renderer. Mac Catalyst may be enabled when the example application's
minimum-build matrix proves it without conditional behavior.

tvOS, watchOS, and visionOS are deferred until the shared static and animated
renderer passes on iOS and macOS. Their eventual inclusion should be a build and
interaction decision, not an assumption based on SwiftUI type availability.

Development currently uses Xcode 26.5 and Swift 6.3.2, but the installed local
toolchain does not define the supported language or deployment floor. Phase 1
must choose the oldest Swift tools version that expresses the package without
compromising its typed value model, then prove that version in CI.

The initial implementation takes no third-party runtime dependency. Foundation
may provide Unicode normalization and basic value support; SwiftUI and Core
Graphics remain confined to the presentation target. A dependency may be added
only with a parity or platform need that cannot be met by the standard SDK.

## Versioning and distribution

The Swift package version is supplied by this repository's Git tags. It joins
the existing Blobatar `v2.x` line rather than starting an independent `0.1.0`
line, because package major 2 selects generation 2 throughout this repository.
The first tag containing the Swift manifest and targets is the first installable
Swift release.

Adding the SDK is additive and must not move any existing name to a different
figure. Release notes and pull requests must say explicitly that the
seed-to-look mapping is unchanged.

The package and source use the repository's MIT license and retain attribution
to Blobatar and its original author. No App Store publication is implied by the
example application.

## Public interface direction

The intended SwiftUI names are `Blobatar` and `AnimatedBlobatar`, matching the
rest of the project. Options are grouped in an immutable `BlobatarOptions`
value, expressions are authored values rather than strings, and animation mode
is a small hover-or-always enum.

The core trait override type distinguishes a pinned scalar from a narrowed set.
It does not expose `[String: Any]`. Public values should conform to `Sendable`,
`Equatable`, and `Hashable` wherever those conformances state truthful value
semantics.

Names are provisional until the Phase 1 package-consumer fixture proves that
module and type qualification remain readable. Changing them within Phase 1 is
cheap; changing them after the first tagged Swift release is a compatibility
decision.

## Commit and review discipline

Work proceeds in one reviewable commit per completed phase unless a phase needs
an independently valuable mechanical prerequisite. Every commit uses:

- A Conventional Commit title, imperative and effect-oriented.
- A detailed body explaining the decision or implementation, why it has that
  shape, the verification performed, and whether the seed-to-look mapping
  changes.

This branch-specific instruction intentionally differs from the repository's
usual subject-only convention in `CONTRIBUTING.md`.

No phase may combine a reference-fixture regeneration with the Swift behavior
that consumes it. Reference changes must identify the pinned TypeScript source
and remain reviewable as source-of-truth changes.

## Phase 0 exit check

- [x] Native port versus SwiftUI presentation responsibilities are defined.
- [x] Blobatar `2.4.0` / generation 2 is the initial parity reference.
- [x] Initial features and non-goals are explicit.
- [x] Source, tests, documentation, and Studio location are fixed.
- [x] Root-manifest distribution and repository integration exceptions are
      recorded.
- [x] Initial iOS and macOS floors are selected for Phase 1 verification.
- [x] Versioning, dependencies, license, and commit rules are recorded.
- [x] No production Swift source or manifest has been added.
