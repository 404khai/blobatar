# The wall — handoff

The landing page's second section is becoming a participatory wall: click an
empty cell, type a name, pick a face, and a blobatar is there for everyone,
permanently.

**The reasoning is in [ADR 0011](./adr/0011-the-wall-is-participatory.md) and is
not repeated here.** Read it first — it is the argument for every constant this
document mentions, and several of its positions reversed at least once during
the work. This file is the map: what exists, what does not, and what will bite.

Branch: `feat/blob-wall`. Preview at `/wall` (`bun run site`, port 3010), which
runs the whole thing against fixture data and is linked from nowhere.

## What is built

Everything that decides what is *true* is pure and tested; everything that
touches a browser is not. That seam is deliberate — the Worker will import the
first half and none of the second.

| File | Lines | What |
| --- | --- | --- |
| `apps/site/src/wall/geometry.ts` | 283 | The rules. Cells, chunks, reach, the empty wall. **Shared with the Worker.** |
| `apps/site/src/wall/camera.ts` | 199 | Pan, zoom-about-pointer, the fly-to arc, the off-screen arrow. Client only. |
| `apps/site/src/wall/chunk.ts` | 165 | The wire format, its decoder, and occupancy over loaded chunks. |
| `apps/site/src/wall/fixture.ts` | 154 | A wall that never existed: dense core, a bridge, "HI" drawn in occupancy. |
| `apps/site/src/wall/expressions.ts` | 37 | The face roster and the `idle` fallback. |
| `apps/site/src/wall/paint.ts` | 260 | Canvas drawing and the sprite cache. Needs a DOM; untested. |
| `apps/site/src/components/WallCanvas.tsx` | 532 | Pointer, camera, the live DOM cell. Untested. |
| `apps/site/pages/wall.tsx` | 302 | The preview page. A development surface, not a destination. |

76 tests across `geometry`, `camera` and `chunk`. `bun test src/wall/` from
`apps/site`.

## What is not built

Everything with a database behind it.

- **The D1 schema and migrations.** `wrangler d1 migrations` is first-party;
  there is no first-party ORM. Start with the raw prepared-statement client
  behind one `worker/wall/db.ts` — the whole surface is about five queries, and
  `.bind()` is already parameterised. `batch()` is a real transaction
  (sequential, non-concurrent, rolls the sequence back on failure), which is
  exactly what "insert placement + bump chunk version" needs. If it ever
  outgrows that, `migrations_pattern` lets wrangler apply drizzle-kit's output,
  so starting raw strands nothing.
- **Chunk serving**, with the versioned-immutable caching ADR 0011 describes:
  a small region index with a short TTL, chunk bodies immutable for a year.
- **The write path**: Turnstile, the `(ip_hash, day)` unique index, the cookie
  token, moderation (length cap, charset, blocklist, authenticated delete).
  ADR 0011 treats moderation as ship-blocking, not follow-up.
- **The overview tile.** Now a v1 item rather than a nice-to-have: a drawing
  made of occupancy is only legible zoomed out, and chunks are the wrong thing
  to serve there. `MIN_ZOOM` is 0.45 only until it exists.
- **Moving the section into `App.tsx`.** It still renders the generated field.

Two things only Alain can do: `wrangler d1 create`, and Turnstile keys in
`.dev.vars` (same pattern as the commercial config — they stay out of the repo).

It belongs in `apps/site/worker/`, **not** `apps/api`, which ADR 0005 keeps free
of anything account-specific so a fork can deploy it. A D1 binding there would
break every fork's deploy. `run_worker_first` has to widen past `/avatar/*`.

## The contracts

**Occupancy is a predicate, plus a separate `populated` flag.** `(x, y) =>
boolean` returning false means "nothing here" to a Worker holding the region and
"nothing fetched yet" to a client, and those must not be confused. The caller
knows which it has; the rules cannot work it out. Every placement question takes
both.

**Nothing is seeded.** The first blobatar is placed by a person and goes at the
origin by rule, which anchors the coordinate system to it. The empty wall is a
real state the rules express, and it lasts exactly one placement.

**The wire format is positional**: `[index, seed, expression, at]`. Slot within
the chunk rather than a coordinate; expression by *name*, never an id into a
table — an id would be an ordering contract with every row ever written. `at` is
whole seconds. `decodeChunk` is defensive about its own shape because bodies are
cached for a year in caches this code cannot reach; a body it does not
understand is discarded, never half-drawn.

**A full chunk can never change.** 1024 of 1024 means frozen forever. Versioning
is the mechanism, fullness is an optimisation on top of it — that ordering
matters, and it is the one the generous reach forced.

## Things that will bite

Each of these cost real time. They are documented at their sites too.

- **Negative zero.** `-0` reaches a cell from three directions — rounding a
  pointer left of the origin, `-r` at ring radius zero, anything that mirrors —
  and it compares equal to `0`, prints as `"0"`, and is a different value to
  `Object.is`, `Map` keys and React's key diffing. Everything goes through
  `cell()` in `geometry.ts`. It bit three times before that existed.
- **The sprite cache must never evict what the current frame drew.** It did, at
  a 400 budget with 500 blobs on screen, and each rebuild fired `onload`, which
  asked for another frame: a hundred SVGs rasterised per frame forever on an
  idle page. Eviction runs *after* the frame and skips `used === frame`.
- **The overlay's position must be set at commit time, not in the rAF.** A frame
  landing between the state change and the commit positions the outgoing node at
  the incoming cell. `useLayoutEffect`, before paint.
- **A `draw` callback whose identity changes re-runs the resize effect**, and
  `canvas.width = …` clears the canvas. That was a full repaint from blank on
  every render anywhere above. Props the draw loop reads go through a ref.
- **Lightning CSS lowers standalone `translate` into `transform`.** So
  "centre on `translate`, animate `transform`" compiles away silently when a
  `transform` follows in the same rule. Both must ride `transform`, and the
  Tailwind `-translate-x-*` utility must not also be on the element or the two
  compose into a whole width. Check the *compiled* stylesheet, not the source.
- **React's `onWheel` is passive** and cannot `preventDefault`, so the listener
  is bound by hand or a trackpad pinch zooms the page.
- **A drag over `DRAG_SLOP` is never a click**, and occupied and empty cells are
  different targets. Running both through `nearestPlaceable` made clicking a
  stranger shove the wall sideways.

## Open decisions

- **Bridges.** Reach is 16, so drawing out in the quiet means first walking a
  trail of blobs to it — 5 stones for the fixture's two-letter word, which cost
  22 placements in total. At one blob per IP per day that is 22 people. Leaving
  it means the wall accumulates roads; `REACH = 32` halves every bridge. Cheap
  to change now, expensive once anyone has placed anything.
- **The cooldown.** A day is slow enough that nothing may ever form. The honest
  loosenings — a shorter cooldown, or letting people move what they placed —
  were both considered and rejected for v1; if the wall stalls, this is the
  first number to revisit.
- **Long names.** The field caps at 24 characters and the hover plate truncates
  at 22. Untested against real names.
