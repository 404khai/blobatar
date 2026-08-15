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

**Expression**:
Which named pose an avatar holds — `idle`, `happy`, `sad`, `mad`. Set by the
consumer and held until changed; the library never picks one and never returns
to `idle` on its own. `idle` is an expression like any other, and the default
one — not the absence of an expression.
An expression is a _value_ a consumer imports and passes, not a name it spells,
so the ones nobody imports do not ship.
_Avoid_: mood, emotion, reaction, state. _Mood_ and _emotion_ describe the
creature; an expression is what is drawn. _Reaction_ implies the library takes
it away again, which it does not.

**Pose**:
What an expression resolves to — the geometry of the eyes, a rigid offset for
the creature, a tremor amplitude, and how far the palette runs toward its hot
pair. Expressions never add or remove a mark, so a `blob` gains no mouth when it
is happy, and they never deform the silhouette, because in `blob` the silhouette
is the identity.
_Avoid_: face, keyframe.

**Differential**:
The part of a pose that applies to the right eye only — the `*2` channels. A
pose states one set of eye values and a delta, never two sets, so an identity of
zero is a symmetric face.
_Avoid_: per-eye override, second eye. There is no second set of values to
override, and "second eye" names the eye rather than the channel.

**Tint**:
The palette an expression wears. Resolved to a finished pair of colors before it
reaches the stylesheet, and derived from the avatar's own palette rather than
authored once, so an angry avatar stays recognisably itself. It is the one pose
channel with no custom property.
_Avoid_: theme, color override.

**Tremor**:
The held shake of an angry avatar. An amplitude on a loop that always runs, not
an event — like every other motion in the library, it has nothing to start and
nothing to replay.
_Avoid_: shake animation, jitter. _Jitter_ is what the seeded layout does to
positions and means something else here.

**Morph**:
The transition from one expression's pose to another's. Symmetric in the sense
that every pair of expressions is reachable — `idle → happy` and `happy → mad`
are the same operation, not a special case each. An expression can be adopted
without a morph: static avatars and `prefers-reduced-motion` render the target
pose directly.
_Avoid_: transition, animation — those are also what the idle loop does, and
the two are separate layers.

**Idle motion**:
The ambient loop every animated avatar runs — breathe, bob, blink, glance. It
is gated on hover and independent of expression, which is triggered by the
consumer and is not gated at all. An avatar can be sad and still breathing.

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
