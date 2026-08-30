# blobatar (Dart/Flutter)

Deterministic geometric blobatars from any string — a faithful Dart/Flutter
port of the [blobatar](https://github.com/Alain00/blobatar) generation-2
engine.

The same name always produces the same avatar. The seed drives only the hue;
lightness and chroma come from a fixed set of authored tone swatches, which is
what makes a grid of these look designed rather than random.

The package has two libraries:

- **`package:blobatar/blobatar.dart`** — the pure, deterministic core: name
  normalization and hashing, the trait stream, the OKLCh palette pipeline
  (gamut handling, contrast enforcement, tinting), and the full generation-2
  layout geometry — all ten silhouettes, face fitting, and frame containment.
  No Flutter import anywhere in it, so pure-Dart consumers stay Flutter-free.
- **`package:blobatar/flutter.dart`** — the Flutter layer: static and animated
  painters plus `Blobatar` and `AnimatedBlobatar` widgets that paint the core
  layout through `dart:ui` `Path`/`Canvas` primitives (never by rasterizing or
  wrapping SVG markup).

## Usage

### The widget

```dart
import 'package:blobatar/flutter.dart';

Blobatar(name: 'alain@example.com', size: 48)

Blobatar(
  name: user.email,
  semanticLabel: 'Avatar of Alain',
  options: const BlobatarOptions(
    background: Backdrop.squircle,
    hue: 210,                 // lock the hue; the name drives shape only
    traits: {'shape': 0.99},  // pin traits in hash units, clamped
    expression: happy,
  ),
)
```

The options are forwarded to the core unchanged (no adapter-invented
defaults). The widget owns sizing, a `RepaintBoundary`, and `Semantics`; the
painter repaints only when the name or the options change by value.

### Animation

```dart
AnimatedBlobatar(
  name: user.email,
  size: 120,
  animation: BlobatarAnimation.always,
  options: const BlobatarOptions(expression: thinking),
)

AnimatedBlobatar(
  name: user.email,
  animation: BlobatarAnimation.hover,
)
```

`always` runs the seeded idle motion continuously. `hover` ramps that motion
in while a pointer is over the widget and adds the matching lift reaction.
Set `active: false` to pause on a deterministic static frame. The widget also
stops its tickers under `TickerMode` and renders the static `Blobatar` path
when `MediaQuery.disableAnimations` requests reduced motion.

### Expressions

All fourteen generation-2 expression values are available from either package
library: `idle`, `happy`, `sad`, `mad`, `surprised`, `wink`, `sleepy`, `smug`,
`unsure`, `scared`, `love`, `shy`, `sick`, and `thinking`.

`AnimatedBlobatar` morphs expression pose and palette changes using the web
timings. Held `mad` expressions tremor and held `thinking` expressions seesaw;
interrupted changes continue from the currently visible pose. Use `Blobatar`
when a permanently static avatar is preferred.

### The core (no Flutter)

```dart
import 'package:blobatar/blobatar.dart';

final traits = traitsFor('alain@example.com');
final layout = style.layout(traits);
final colors = ramp(210); // {bg: #..., head: #..., eye: #...}
```

- `traitsFor(seed)` — normalized (NFC + trim + lowercase) trait reader.
- `layoutFor(seed, options)` / `partsFor(seed, options)` — the resolved
  numeric layout and palette, backing every renderer.
- `palette(hue, enforce, tone)` / `ramp(...)` — the authored ramp.
- `superellipse` / `blobPath` / `polygon` — the path primitives, emitting
  structured segments and byte-exact SVG path data.

## Parity

The core is validated against a reference-vector fixture exported once from the
TypeScript implementation at blobatar `2.4.0` by
`tools/export-reference-vectors.ts`. The fixture lives at
`test/fixtures/reference-vectors.json` and `test/dart/parity_test.dart` checks
the port against it: hash states, trait streams, override reads, palette hex
values and path data compare exactly; trig-derived layout floats compare under
a documented tight relative tolerance (1e-9), because `dart:math`'s
`cos`/`sin` call the host C library and IEEE 754 does not mandate one
implementation. See `../../docs/flutter-port/reference-vectors.md`.

The Flutter layer re-anchors that geometry at the canvas: the `ui.Path`
objects the painter draws are mechanical conversions of the same segments the
fixture pins, so the drawn geometry equals the reference by construction; the
tests additionally verify frame containment, raster determinism (same seed,
identical pixels; different seeds, different pixels), and the backdrop
behaviors. The only documented difference from a browser rasterization is
engine-level antialiasing.

The container guarantees hold under any configuration: decorations and eyes
stay inside the body, and the body stays inside the 100-by-100 frame.
`test/dart/containment_test.dart` asserts this over 6000 seeds and an override
sweep, mirroring `packages/blobatar/test/geometry.test.ts`.

## Example

`example/` is an interactive studio for changing a seed, shape, expression,
hue, backdrop, and motion mode. It also shows held expression loops, a
hover-animated seeded gallery, and the fixed Claude/Codex web presets.

```sh
cd packages/flutter/example
flutter run -d chrome
```

## Development

```sh
cd packages/flutter
flutter pub get
dart format --set-exit-if-changed .
dart analyze
dart test test/dart      # the pure-Dart core suite
flutter test             # everything, including the widget layer
```

The example app checks itself:

```sh
cd packages/flutter/example
flutter analyze && flutter test
```

The reference vectors are regenerated with `BLOBATAR_TS_SRC` pointing at a
v2.4.0 checkout of the TypeScript library, never from this package's own
output:

```sh
BLOBATAR_TS_SRC=/path/to/blobatar-v2.4.0/packages/blobatar/src \
  bun tools/export-reference-vectors.ts
```
