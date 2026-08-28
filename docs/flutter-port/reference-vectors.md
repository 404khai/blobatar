# Reference vectors — export and checking strategy

Status: proposed schema, awaiting the maintainer's file-shape call
([issue #29](https://github.com/Alain00/blobatar/issues/29#issuecomment-5458106206))  
Reference: Blobatar `2.4.0`, generation 2  
Companion: [`phase-0-coordination.md`](./phase-0-coordination.md)

The maintainer asked for the reference vectors to exist as a published artifact
in this repository, so any port has one definition of correct. This document
fixes the strategy, the schema, the coverage rules, and the comparison rules
before any Dart code is written. Rart3001 published a working schema for their
port in the issue thread; this schema deliberately stays compatible with it so
the ecosystem can converge on one shape instead of forking the definition of
correct.

## Principles

1. **Generated once, from the TypeScript implementation, at a pinned release.**
   The export script runs against `packages/blobatar` source at tag `v2.4.0`
   (or the maintainer's preferred pin) inside this Bun workspace. It is never
   run against, adjusted toward, or regenerated from the Dart port's own
   output. A vector recorded from the thing under test proves nothing.
2. **Checked in, reviewed like code.** The fixture lands in this repository as
   a reviewed artifact. Regeneration requires an explicit version bump of the
   `meta.version` field and a commit that says so.
3. **Every comparison rule is written in the fixture.** Where exact equality is
   meaningful (integers, hex strings, hash words), the fixture says exact.
   Where it is not (trig-derived layout floats across engines), the fixture
   carries the tolerance per field class and a note explaining why. No port may
   relax a tolerance without documenting the deviation against this file.
4. **One file, self-describing.** `meta` carries enough to detect generation
   drift, a version mismatch, or a truncated export by reading it, without
   re-deriving anything by hand.

## Export strategy

The exporter is a small TypeScript script (planned location
`tools/export-reference-vectors.ts` in this repo, added in an early port phase)
that:

- imports the core deterministically (normalization, hash, traits, color,
  layout, pose, motion) the same way the library's own tests do;
- iterates the fixed case list below;
- emits one JSON file, formatted, with sorted keys for stable diffs;
- prints a summary line per silhouette band so a truncated or drifted export is
  visible at generation time.

The exporter lives beside the TypeScript sources it reads and is the only
sanctioned producer of the fixture. The Dart side gets read-only access.

## Schema

Versioned by `meta.schemaVersion`. Additive changes bump the minor; any
breaking change bumps the major and regenerates the file.

```jsonc
{
  "meta": {
    "schemaVersion": 1,
    "upstream": "https://github.com/Alain00/blobatar",
    "version": "2.4.0",        // the pinned release the vectors were exported from
    "generation": "gen2",
    "exportedWith": "<git sha of the export script commit>",
    "shapeCounts": {           // cases per silhouette band; must match the counts below
      "organic": 25, "round": 25, "boxy": 25, "drop": 25, "gem": 25,
      "capsule": 25, "flower": 25, "gear": 25, "shield": 25, "squircle": 25
    },
    "comparisonRules": {
      "exact": ["hash", "traits", "palette", "pose", "hex", "integers"],
      "relativeTolerance": {
        "layout": 1e-9,        // trig-derived geometry; see the note below
        "note": "dart:math cos/sin call the host C math library; IEEE 754 does not mandate one bit-exact implementation. Cross-engine differences of one ULP are expected and are not parity failures."
      }
    }
  },
  "expressions": {             // static pose channels per expression value, idle included
    "idle":   { "esx": 1, "esy": 1, "tilt": 0, "...": "..." },
    "happy":  { "...": "..." }
  },
  "motion": {                  // seeded idle-motion parameters, per plan phase 4
    "breathe": { "periodMs": 2800, "...": "..." },
    "bob":     { "periodMs": 3400, "...": "..." },
    "blink":   { "minMs": 3500, "maxMs": 6500, "seeds": { "...": "..." } },
    "saccade": { "minMs": 4200, "maxMs": 7600, "seeds": { "...": "..." } }
  },
  "cases": [
    {
      "seed": "user-0",
      "shape": "organic",
      "hash":  { "h1": 0, "h2": 0, "bytes": [] },   // uint32 words and UTF-8 bytes
      "traits": { "shape": "organic", "eyes": "dot", "...": "..." },
      "body":  { "cx": 0, "cy": 0, "rx": 0, "n": 0, "radii": [] },
      "face":  { "...": "..." },
      "eyes":  { "...": "..." },
      "petals":{ "...": "..." },
      "extra": { "...": "..." },
      "hue": 0,
      "tone": "",
      "palette": { "body": "#……", "bodyShade": "#……", "eye": "#……", "...": "..." },
      "overrides": { "...": "..." }   // echo of any trait overrides the case applied
    }
  ]
}
```

Field names inside `body`, `face`, `eyes`, `petals`, and `extra` mirror the
resolved layout object the renderer produces, keeping the fixture a faithful
record of the frozen seed-to-look contract rather than an invented
intermediate. The exact key set is finalized when the exporter is written, from
the `2.4.0` sources, and recorded here before Phase 1 consumes it.

## Required coverage

- **Normalization edges:** precomposed Latin, decomposed Latin (NFD input that
  NFC-collapses), untrimmed mixed case, empty and whitespace-only names.
- **Non-ASCII input:** accented Latin, CJK, and at least one non-BMP character
  (surrogate pair) per Rart3001's suite.
- **All ten silhouette bands:** at least 25 cases per band, chosen by scanning
  seeds until each band meets its quota.
- **Palette and tone edges:** every tone ramp value, hue wrap boundaries
  (`0`, `360` epsilon), contrast-enforcement triggers, palette override cases.
- **Trait overrides:** at least one case exercising clamped/invalid override
  handling per override kind.
- **Static expressions:** all fourteen values (`idle` through `thinking`),
  resolved against at least three different silhouettes, with `idle` equal to
  an omitted expression.
- **Motion parameters:** the seeded periods, phases, and delays for breathe,
  bob, blink, and saccades, for a spread of seeds (consumed by Phase 4).

## Checking strategy (Dart side)

- The fixture is committed once and the Dart test reads it read-only. The port
  never writes it.
- Hash, traits, palette, pose, and all integer/hex fields compare exactly.
- Layout floats compare with the `meta.comparisonRules.relativeTolerance`
  value and only for fields the rules list; anything else failing exact
  equality is a parity bug in the port, not a fixture problem.
- The TypeScript golden suite in `packages/blobatar/test/` is untouched. The
  fixture adds a cross-language artifact; it does not replace or edit any
  existing golden.
- If the maintainer prefers a different file shape, the schema above bends to
  it before Phase 1; the principles section does not.


