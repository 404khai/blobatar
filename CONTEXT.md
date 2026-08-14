# Morphatar

A library that turns any string into a deterministic geometric avatar, plus the
apps that exercise it — a landing page and a tuning grid.

## Language

### The avatar

**Seed**:
The input string an avatar is derived from. Normalized (NFC, trimmed,
lowercased) before hashing unless `normalize: false`.
_Avoid_: username, input, name — those are what a seed happens to be on the
landing page, not what it is.

**Avatar**:
A single rendered figure. The library is `morphatar`; the thing it renders is an
avatar.
_Avoid_: morphavatar, morphater, identicon.

**Variant**:
Which family an avatar is drawn from: `blob` or `character`. Set explicitly via
options; defaults to `blob`.
_Avoid_: style, type, kind.

**Shape**:
Which silhouette a `blob` takes — `round`, `organic`, `boxy`, `nub`, `cloud`, or
`sun`. **Derived from the seed, never set directly.** There is no `shape`
option, and there is no `shape` axis for `character` at all.
_Avoid_: variant, form. Conflating shape with variant is the most common
mistake: `blob` is a variant, `round` is a shape, and one contains the other.

**Trait**:
A named value pulled from the seed's hash by string key (`"hue"`, `"body.r"`),
rather than from a sequential stream. Keying by string is what lets a later
minor version add a trait without disturbing existing avatars.

**Tone**:
A position in the frozen swatch set for `blob`, expressible as 0–1. Distinct
from `hue`, which is an absolute angle in degrees.

**Rendering mode**:
Static avatars are a single `<img>`; animated ones are inline SVG of roughly a
dozen nodes. `animate` selects between them — the two cannot be combined,
because `:hover` and host-page CSS cannot reach inside an `<img>`.

### The repo

**Package**:
A workspace member under `packages/` — publishable. Currently just
`morphatar` itself.

**App**:
A workspace member under `apps/` — never published, and always consumes
`morphatar` through its public `exports` map rather than by relative path.

**Site**:
The public landing page (`apps/site`). Static, dark-only, editorial.
_Avoid_: demo, docs.

**Tuning grid**:
The internal design tool (`apps/demo`) that renders avatars in aggregate so
numeric ranges can be judged as clusters and outliers rather than one seed at a
time.
_Avoid_: demo app, playground, storybook.

**Wall**:
The landing page's parallax field of avatars illustrating "millions of
options". Distinct from the tuning grid, which serves design work, not
persuasion.
