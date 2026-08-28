# blobatar (Dart)

Deterministic geometric blobatars from any string — a faithful Dart port of the
[blobatar](https://github.com/Alain00/blobatar) generation-2 engine.

The same name always produces the same avatar. The seed drives only the hue;
lightness and chroma come from a fixed set of authored tone swatches, which is
what makes a grid of these look designed rather than random.

For the entire feature set of the JavaScript library, this Dart package is the
**pure, deterministic core**: name normalization and hashing, the trait stream,
the OKLCh palette pipeline (gamut handling, contrast enforcement, tinting), and
the full generation-2 layout geometry — all ten silhouettes, face fitting, and
frame containment. It is independent of Flutter, so Dart-only consumers can use
it without importing Flutter; the Flutter widget and painter land in a later
port phase and will never be a dependency of this core.

## Parity

The core is validated against a reference-vector fixture exported once from the
TypeScript implementation at blobatar `2.4.0` by
`tools/export-reference-vectors.ts`. The fixture lives at
`test/fixtures/reference-vectors.json` and `test/parity_test.dart` checks the
port against it: hash states, trait streams, override reads, palette hex values
and path data compare exactly; trig-derived layout floats compare under a
documented tight relative tolerance (1e-9), because `dart:math`'s
`cos`/`sin` call the host C library and IEEE 754 does not mandate one
implementation. See `../../docs/flutter-port/reference-vectors.md`.

The container guarantees hold under any configuration: decorations and eyes
stay inside the body, and the body stays inside the 100-by-100 frame.
`test/containment_test.dart` asserts this over 6000 seeds and an override
sweep, mirroring `packages/blobatar/test/geometry.test.ts`.

## Usage

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

## Development

```sh
cd packages/flutter
dart pub get
dart format --set-exit-if-changed .
dart analyze
dart test
```

The reference vectors are regenerated with `BLOBATAR_TS_SRC` pointing at a
v2.4.0 checkout of the TypeScript library, never from this package's own
output:

```sh
BLOBATAR_TS_SRC=/path/to/blobatar-v2.4.0/packages/blobatar/src \
  bun tools/export-reference-vectors.ts
```