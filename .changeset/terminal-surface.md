---
"@blobatar/cli": minor
---

Add `@blobatar/cli`, the terminal surface: `blobatar <name>` prints SVG to
stdout, `-o` writes `.svg` or `.png`, and `--stdin -d` renders a batch with
collision-safe deterministic filenames.

The render options are spelled as the endpoint spells them — `--size`,
`--background`, `--hue`, `--tone`, `--expression`, `--title`, `--gen` — so a
flag and a query key are the same word. `--no-normalize` is the one flag a URL
has no spelling of, since a URL always normalizes.

Runs under plain Node (>= 18) so `npx` works outside a Bun project, and bundles
both generations: `--gen 1` renders the frozen v1 major, `--gen 2` the current
one.

Lockstep means this is a minor for the whole group, including `blobatar`
itself, whose code this release does not touch.
