# Generations

A **generation** is one frozen seed → look mapping: the silhouette vocabulary
and its thresholds, every numeric range the layout reads a trait into, and the
tone set. `gen1` is the original six shapes. Callers pin one with
`blobatar(name, { generation: gen1 })` or `/avatar/<name>?gen=1`.

This exists because more shapes are coming and adding one is not additive.

## Why a shape cannot just be added

`shapeOf` partitions `[0, 1)` into six bands. A seventh shape has to take its
probability mass from the existing ones, so every seed in the moved region
changes silhouette — somebody's avatar becomes somebody else's. There is no
arrangement that avoids this: reserving a tail would have had to happen in
0.1.0, and subdividing one band still moves everyone inside it.

So the choice was never "how do we add shapes without breaking anyone". It was
"who decides when the break happens", and the only possible answer is the
caller, because the library cannot know who is relying on the old vocabulary.

## What was actually missing

Not the mechanism — `Style<L>` in `render.ts` was already exactly a generation,
and `makeBlobatar(style)` already took one. What was missing was the *freeze*.

The README has promised determinism within a major since 0.1.0, and nothing
enforced it. Every determinism test in the suite asserted self-consistency —
same seed twice in one process — which is a property the library could not
plausibly lose. A one-character edit to `shapeOf` reshuffled every existing
user's avatar and CI stayed green.

`test/golden/gen1.txt` is the correction: 1312 recorded renders, 14 full SVGs
and a shape histogram over 20,000 seeds. The histogram earns its place by
naming the cause — a threshold edit reports `boxy 2792 → 2975`, where a markup
hash only reports that something moved. `scripts/golden.ts` refuses to write
without `--write`, because the failure mode for a fixture like this is somebody
regenerating it to get back to green.

Doing that first was the whole point of the sequencing. The seam landed second,
and it is only believable because gen1's fixture passed through it unchanged.

## The default follows the major

`blobatar@1` renders gen1; a later major renders whatever is newest then. The
alternative — a default pinned to gen1 forever — was rejected even though it is
the stronger guarantee on paper, because it makes the default permanently the
oldest thing in the package and every new adopter has to know to opt out of it.

Existing users are protected by staying on the major they are on, which is what
a major is for. Every generation stays importable in every later major, so
pinning is how a caller keeps their users' blobatars through the upgrade.

A generation is a passed-in value rather than a string naming a table, for the
reason ADR-0002 gives for expressions: a consumer who never names one carries
only the default. The core-side cost is 23 B — `makeBlobatar` and `makeParts`
reading an option instead of closing over a style — and everything else is paid
by whoever asks.

The one non-obvious consequence is in `blobatar/react`, which memoizes on
`JSON.stringify` of its options. A generation is three functions and a
background flag, and `JSON.stringify` drops functions, so two generations
serialize identically. That is why `Generation` carries an `id`: without
something scalar to compare, switching generation would not invalidate the memo
and the component would keep rendering the old one. Expressions survive the
same hazard by accident — their pose is data.

## The endpoint is the other way round, on purpose

`/avatar/<name>` renders gen1 and always will, even after the deployed library's
default moves.

The asymmetry is not an inconsistency. In the library the caller chooses when to
move, by upgrading; on the endpoint they never choose, because we deploy. Every
`<img>` already pasted into somebody's README is an unversioned one, and a
default that followed the library would rewrite all of them on a Tuesday.

`?gen=` over the `/avatar/v1/<name>` path ADR-0004 anticipated. Both put the
generation in the cache key, which is all the caching argument needs; the path
form also puts a reserved namespace in front of user-supplied names, making
`/avatar/v2` permanently ambiguous between a version and somebody called `v2`,
and costing `parseName` its "a name never contains a slash" rule. A parameter
reads as what it is — another render option beside `size` and `hue` — and leaves
the Gravatar host-swap untouched.

That answers the cache note ADR-0004 left open. A pinned URL cannot come back
different, which is the precondition an unpurgeable year-long cache needs, so
`?gen=` responses go out `immutable, max-age=31536000` and unversioned ones keep
the day-long `stale-while-revalidate`. It is measured off the raw query rather
than the parsed options: an unversioned URL resolves to gen1 too, and must not
inherit the cache of a promise it never made.

`GENERATIONS` in `params.ts` only ever grows. A generation that has appeared in
a URL has to keep answering — that is the entire promise `?gen=` makes.

**Revisit when** there are three or four generations. Every one of them is code
in the deployed Worker and a public path in the package forever, and at some
point the honest move is to stop adding vocabularies and start a second library.
The first sign will be `params.ts`'s table reading like a museum rather than a
menu.
