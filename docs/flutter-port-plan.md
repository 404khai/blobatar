# Flutter/Dart port plan

Status: implementing — Phase 1 (deterministic Dart core) landed  
Branch: `feat/flutter-dart-port`  
Reference: Blobatar `2.4.0` / generation 2  
Upstream request: [issue #29](https://github.com/Alain00/blobatar/issues/29)

This document plans a native Dart/Flutter port of Blobatar. It does not copy
another implementation from the issue. The issue thread grew to include two
other ports, a maintainer ruling on the pub.dev name, and a published
reference-vector schema; Phase 0 recorded that coordination in the
[phase 0 record](flutter-port/phase-0-coordination.md), and the reference-vector
strategy in [reference vectors](flutter-port/reference-vectors.md).

This port is the fork's own official SDK: it is developed in this repository,
published to pub.dev, and offered upstream to `Alain00/blobatar` once complete.
Per phase it lands as a PR against this repository's `main`.

## Repository analysis

The repository is a Bun/TypeScript monorepo. The root [README](../README.md)
defines Blobatar as a deterministic function of a name and documents the public
options, ten generation-2 silhouettes, palette controls, fourteen expressions
(including `idle`), and opt-in animation. The [contributor guide](../CONTRIBUTING.md)
defines the package layout, the core-versus-adapter boundary, the frozen
seed-to-look contract, the test gate, and Conventional Commit requirements.

The relevant ownership seams are:

| Existing area | Porting responsibility |
| --- | --- |
| [`packages/blobatar/src/hash.ts`](../packages/blobatar/src/hash.ts) | NFC/trim/lowercase normalization, UTF-8 encoding, 32-bit hashing, and keyed trait streams. |
| [`packages/blobatar/src/traits.ts`](../packages/blobatar/src/traits.ts) | Stable numeric, integer, boolean, choice, jitter, and override semantics. |
| [`packages/blobatar/src/color.ts`](../packages/blobatar/src/color.ts) | OKLCh conversion, gamut handling, tone ramps, contrast enforcement, palette overrides, and expression tints. |
| [`packages/blobatar/src/shape.ts`](../packages/blobatar/src/shape.ts) | Superellipses, organic paths, polygons, capsules, and droplet geometry. |
| [`packages/blobatar/src/styles/shapes.ts`](../packages/blobatar/src/styles/shapes.ts) and [`styles/compose.ts`](../packages/blobatar/src/styles/compose.ts) | Ten silhouettes, face regions, decorations, eye fitting, and containment arithmetic. |
| [`packages/blobatar/src/styles/blob.ts`](../packages/blobatar/src/styles/blob.ts) | Generation-2 silhouette bands and their frozen weights. |
| [`packages/blobatar/src/render.ts`](../packages/blobatar/src/render.ts) | Option resolution, static pose application, backdrop behavior, and the renderer seam. |
| [`packages/blobatar/src/expression.ts`](../packages/blobatar/src/expression.ts) | Fourteen expression values: `idle` plus thirteen non-idle poses, static baking, animated channels, and tints. |
| [`packages/blobatar/src/animate.ts`](../packages/blobatar/src/animate.ts) and [`motion.css`](../packages/blobatar/src/motion.css) | Seeded idle-motion parameters and CSS composition rules to translate into elapsed-time Flutter animation. |
| [`packages/blobatar/test/`](../packages/blobatar/test) and [`packages/harness/`](../packages/harness) | Hash/color/geometry/golden/expression/motion coverage and cross-adapter behavior that the Dart package must mirror. |

The Dart package lives at `packages/flutter` with the conventional Flutter
layout (`pubspec.yaml`, `lib/`, `test/`, and — from Phase 2 — `example/`). The
directory deliberately has no `package.json`, so the Bun workspace and turbo
ignore it. Keep the pure deterministic engine separate from the Flutter widget
and painter so Dart-only consumers can use the renderer without importing
Flutter. The pub.dev package name is `blobatar` (to be confirmed with the
maintainer before publishing; `blobatar_flutter` was the fallback).

## Invariants for every phase

- The reference is the released generation-2 implementation, not a visual
  approximation. Existing seed-to-look mappings must not be changed.
- A name is normalized and hashed once; every trait key is independently derived
  from that state, so adding a trait read cannot perturb existing traits.
- Dart must preserve the JavaScript uint32 behavior, including multiplication,
  shifts, overflow, UTF-8 bytes, and the `[0, 1)` stream range.
- Static output and animated output must begin from the same layout and palette.
- Geometry must retain the existing containment guarantees: decorations and eyes
  stay inside the body and the body stays inside the 100-by-100 frame.
- No undocumented parity deviation is acceptable. Any unavoidable difference
  must have a test, a package-doc note, and an explicit upstream PR note.
- Do not alter the TypeScript generation-2 golden fixture to make the port pass;
  generate Dart reference vectors from the existing implementation instead.

## Phases

### Phase 0 — coordination and contract freeze

Scope:

- Comment on [issue #29](https://github.com/Alain00/blobatar/issues/29) before
  coding: acknowledge the existing proposal, state that this port will be
  developed in the fork, and ask whether the author wants to collaborate.
- Confirm the pub.dev package name, supported Dart/Flutter SDK range, package
  location, license, and whether the first PR should target the current
  `2.4.0` generation.
- Treat the issue’s claimed NFC approximation and missing secondary-eye wrap as
  open parity questions, not accepted behavior.
- Add a reproducible reference-vector export/checking strategy. Vectors should
  cover normalized and non-ASCII names, all silhouette bands, palette/tone
  edges, trait overrides, static expressions, and motion parameters.

Exit criteria:

- Maintainer-facing scope and package-name decision are recorded in the PR or
  issue discussion.
- The reference version and vector schema are written down before Dart code is
  added.

Commit subject: `docs: plan Flutter Dart port`

### Phase 1 — pure Dart deterministic core

Scope:

- Scaffold the Dart package and its Dart-only public API.
- Port normalization, UTF-8 encoding, the uint32 hash/finalizer, keyed trait
  streams, clamped overrides, and all trait helpers.
- Port OKLCh conversion, gamut reduction, hex serialization, tone ramps,
  contrast enforcement, palette overrides, and the expression tint primitives.
- Port the geometry primitives and generation-2 layout: all ten silhouettes,
  band thresholds, shape-specific decorations, eye fitting, and frame
  containment.
- Keep the core independent of Flutter and avoid exposing the TypeScript
  renderer’s private layout object as a long-term public API.

Tests and acceptance:

- Dart unit tests for hash vectors, normalization, trait boundaries, color
  conversions, contrast, shape primitives, and containment.
- Cross-language reference vectors compare resolved numeric layout and palette
  values against Blobatar `2.4.0`; equality is exact where serialization makes
  that meaningful, otherwise the comparison rule is specified in the fixture.
- Golden cases include empty/whitespace/case variants, non-ASCII input, every
  silhouette band, overrides, background settings, and tone/hue edges.

Commit subject: `feat: add deterministic Dart blobatar core`

### Phase 2 — static Flutter renderer and widget

Scope:

- Render the core layout through Flutter `Path`/`Canvas` primitives rather than
  wrapping or rasterizing the JavaScript SVG output.
- Add a `CustomPainter` and a small `Blobatar` widget that owns sizing,
  repaint boundaries, semantics, and `name`/option updates.
- Mirror the static API: name, size, background, hue, tone, palette, trait
  overrides, normalization, contrast, title/semantic label, and static
  expression selection where already available from the core.
- Define the public types so callers can use a pure renderer and the widget
  without depending on internal geometry structs.

Tests and acceptance:

- Widget tests verify rebuilds, sizing, semantics, transparent and shaped
  backgrounds, and option forwarding without adapter-invented defaults.
- Raster or path-based fixtures compare representative Flutter output against
  the reference vectors, allowing only a documented antialiasing difference.
- An example app displays a deterministic grid and demonstrates the same name
  producing the same avatar after restart.

Commit subject: `feat: add static Flutter blobatar widget`

### Phase 3 — expression parity

Scope:

- Port every expression value from [`expression.ts`](../packages/blobatar/src/expression.ts):
  `idle`, `happy`, `sad`, `mad`, `surprised`, `wink`, `sleepy`, `smug`,
  `unsure`, `scared`, `love`, `shy`, `sick`, and `thinking`.
- Preserve the existing channel model: eye scale/shape/lean/offset channels,
  body or eye transforms where defined, asymmetric eyes, tinting, and the
  thinking loop parameters.
- Make static expression rendering use the same pose application and palette
  tint rules as the future animated path.
- Keep expressions as values/types rather than making the widget depend on a
  string-to-expression registry; callers should pay only for expressions they
  use where Dart tree-shaking permits it.

Tests and acceptance:

- Every expression has a reference-vector case and a static widget test.
- Static pose output agrees with the TypeScript baked pose for the same seed and
  options; idle remains identical to an omitted expression.
- Geometry tests cover extreme poses, per-eye asymmetry, tint/contrast behavior,
  and frame containment.
- The implementation records whether the TypeScript expression spec’s
  reduced-motion and accessibility expectations are preserved in Flutter.

Commit subject: `feat: port blobatar expressions to Dart`

### Phase 4 — elapsed-time animation and interaction

Scope:

- Replace CSS keyframes with a Flutter animation model driven by elapsed time,
  using `Ticker`/`AnimationController` or an equivalent lifecycle-safe design.
- Port seeded independent phases and periods for breathe, bob, blink, and idle
  saccades; the source motion spec defines 2800ms breathe, 3400ms bob,
  seeded 3500–6500ms blink, and seeded 4200–7600ms saccades.
- Preserve the `hover` versus `always` intent, expression transition timing and
  easing, thinking’s held loop, and the reduced-motion behavior.
- Implement the secondary-eye saccade wrap if it can be expressed faithfully;
  otherwise document and test the exact deviation before requesting review.
- Ensure animation controllers pause/dispose correctly, do not restart when
  unrelated widget properties change, and do not animate off-screen lists
  unnecessarily.

Tests and acceptance:

- Deterministic frame tests at selected elapsed times compare motion channels,
  transforms, colors, and expression transitions to reference calculations.
- Tests prove independent seeded phases, no unintentional synchronization, and
  continuity when expression state changes.
- Widget tests cover hover/always, reduced motion, lifecycle disposal, and
  controller reuse. The example app visibly demonstrates the full motion set.

Commit subject: `feat: add animated Flutter blobatars`

### Phase 5 — package quality, documentation, and upstream PR

Scope:

- Complete `pubspec.yaml`, API docs, README usage, changelog entry, license
  attribution, supported-platform notes, and the example app.
- Add CI commands for `dart format`, `dart analyze`, Dart tests, and Flutter
  widget/example tests without coupling Dart package installation to Bun.
- Add a parity table documenting supported options, expressions, motion modes,
  and any remaining differences from the JavaScript package.
- Run the repository’s relevant TypeScript checks unchanged; the port must not
  modify generation-2 source or golden fixtures.
- Offer the finished SDK upstream to `Alain00/blobatar` once the maintainer
  approves: explain the implementation boundary, list any deviations, and
  include the parity test evidence. Do not publish to pub.dev before
  maintainer approval.

Exit criteria:

- Clean Dart/Flutter analysis and tests on the supported SDK matrix.
- Reference vectors and representative screenshots are attached or linked.
- The PR clearly states whether seed-to-look mapping is untouched and whether
  the package name was approved.

Commit subject: `docs: document Flutter port and parity`

## Git workflow

The fork is configured as `origin` and the source repository as `upstream`:

```text
origin   https://github.com/404khai/blobatar.git
upstream https://github.com/Alain00/blobatar.git
```

Work on `feat/flutter-dart-port`, periodically fetch `upstream`, and keep each
phase reviewable. After each phase, use the commit subject listed above, push
to `origin`, and open a phase PR against `origin/main` with the details of the
work. Do not publish to pub.dev and do not open a PR against the upstream
repository until the maintainer approves.

## Sources

- [Blobatar README](../README.md)
- [Contributing guide](../CONTRIBUTING.md)
- [Project vocabulary](../CONTEXT.md)
- [Generation and package-major ADRs](./adr/0006-generations.md), [ADR-0008](./adr/0008-package-majors-select-generations.md)
- [Adapter boundary ADR](./adr/0009-adapters-as-their-own-packages.md)
- [Expression specification](../packages/blobatar/docs/expression-spec.md)
- [Motion specification](../packages/blobatar/docs/motion-spec.md)
- [Flutter/Dart issue #29](https://github.com/Alain00/blobatar/issues/29)
