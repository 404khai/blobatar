# morphatar

Deterministic geometric avatars from any string. No dependencies, ~3.3 KB gzipped.

```ts
import { avatar } from "morphatar";

avatar("alain@example.com"); // => '<svg xmlns="..." viewBox="0 0 100 100">…'
```

```tsx
import { Avatar } from "morphatar/react";

<Avatar seed={user.email} size={48} />;
```

```ts
import { avatarUri } from "morphatar/uri";

el.style.backgroundImage = `url("${avatarUri(user.id)}")`;
```

## Variants

**`blob`** (default) — a soft body and two capsule eyes, drawn from a vocabulary
of six silhouettes: `round`, `organic`, `boxy`, `nub`, `cloud`, `sun`. Weighted
so rounds and pebbles are everyday and suns are a find. Transparent backdrop by
default; the body is the avatar.

**`character`** — a flat face with eyes, brows, mouth, hair and ears on a
squircle plate.

```ts
avatar(seed, { variant: "character" });
```

Importing `morphatar` carries both. If you ship one, import it directly and save
about a kilobyte:

```ts
import { avatar } from "morphatar/blob";
```

## What it guarantees

**Determinism.** The same seed always renders the same avatar within a major
version. Numeric ranges, the shape thresholds and the tone set are all part of
that contract.

**Stability across versions.** Traits are addressed by string key rather than
drawn from a sequential stream, so adding a trait in a later minor cannot
disturb existing avatars. Adding a shape or a tone _would_, so those are frozen
per major.

**Contrast.** Eyes clear 4.5:1 against the body at every hue and every tone —
verified at 1° resolution in the test suite. Polarity flips automatically, so
the near-black tone gets light eyes rather than an invisible face. `character`
additionally holds its head above the backdrop and its ink above the head.
Colors passed via the `palette` option bypass all of this, by definition.

**Seed normalization.** Seeds are NFC-normalized, trimmed and lowercased before
hashing, so `Alain@Example.com` and `alain@example.com` agree, as do the
precomposed and decomposed spellings of `café`. Pass `normalize: false` to hash
the raw string. Hashing runs over UTF-8 bytes, so non-ASCII and astral-plane
seeds (`日本語`, `🦊`) behave consistently across engines.

**No element ids.** Nothing uses `<defs>`, gradients or filters, so rendering
several hundred avatars on one page cannot produce id collisions.

## Options

| Option       | Default    | Notes                                                   |
| ------------ | ---------- | ------------------------------------------------------- |
| `variant`    | `"blob"`   | `"blob"` or `"character"`.                              |
| `size`       | —          | Emits `width`/`height`. Omit to let CSS size it.         |
| `background` | per variant | `"squircle"`, `"circle"`, `"square"`, or `false`.       |
| `hue`        | —          | Locks hue in degrees; the seed then drives shape only.   |
| `tone`       | —          | Locks the `blob` swatch as a 0–1 position in the set.    |
| `palette`    | —          | Per-key hex overrides. Bypasses the contrast guarantee.  |
| `normalize`  | `true`     | NFC + trim + lowercase.                                  |
| `contrast`   | `true`     | Enforce the contrast floors.                             |
| `title`      | —          | Adds a `<title>` for screen readers.                     |

## How it works

**One primitive carries the symmetric shapes** — the superellipse
`|x/a|^n + |y/b|^n = 1`. `n=2` is an ellipse, `n≈4` a squircle, `n≈5` a rounded
bar. Each quadrant is one cubic Bézier whose control offset is solved so the
curve passes exactly through the 45° point; at `n=2` that yields 0.5523, the
standard circle constant. Four segments keeps a part at ~130 bytes of path data.

**A closed Catmull-Rom spline carries the organic ones.** Radii sampled around a
circle and joined into a loop, so a seed perturbing them by ±16% produces
lopsided pebbles with no noise function. Catmull-Rom interpolates its points
exactly, which is what makes the radii mean what they say and keeps containment
predictable.

**Overlapping fills replace boolean geometry.** Clouds, suns and nubs are just
extra circles drawn in the same `<g fill>` behind the core. They union visually
for free — no path arithmetic, no clip paths, no element ids.

**Eye dimensions are fractions of the body radius**, not absolute units. Bodies
range from 22 to 38 units depending on how much room the decoration needs, and
absolute sizes would drift off a small sun while looking lost on a large round.

Colors are resolved from OKLCh to hex at render time rather than emitted as
`oklch()`, because server-side rasterizers largely do not support it and avatars
get rasterized server-side constantly.

Whole avatars land at 590–1060 bytes of markup.

## Development

```sh
bun dev      # tuning grid at localhost:3000
bun test     # 65 tests
bun run size # per-entry gzip budgets
bun run check
```

The tuning grid is the real design tool. Numeric ranges can only be judged in
aggregate — you are looking for clusters, dead zones and outliers, which are
invisible when you inspect one seed at a time. The shape filter exists because
the rarer silhouettes would otherwise show up a handful of times per page, too
few to tune against.

`test/geometry.test.ts` covers what eyeballing cannot: that no seed anywhere in
the space puts an eye off the body, fuses two capsules together, detaches a
petal, or pushes geometry outside the frame.
