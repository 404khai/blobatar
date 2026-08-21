# The wall — handoff

The landing page's second section is becoming a participatory wall: click an
empty cell, type a name, pick a face, and a blobatar is there for everyone,
permanently.

**The reasoning is in [ADR 0011](./adr/0011-the-wall-is-participatory.md) and is
not repeated here.** Read it first — it is the argument for every constant this
document mentions, and several of its positions reversed at least once during
the work; the blockquotes in it are the ones that moved while the server was
being built. This file is the map: what exists, what does not, and what will
bite.

It is live on the landing page: `src/App.tsx` renders `WallSection` where the
generated field used to be. Against a wall nobody has written to yet, that
section is the generated field with an empty canvas over it — the cold start ADR
0011 describes — and `/?wall=fixture` renders it against the five-thousand-blob
fixture instead, which is the only way to see it busy before anyone has filled
it.

Branch: `feat/blob-wall`. Running it:

- **`bun run site`** (port 3000, or `PORT`) serves the wall's five endpoints
  itself — the same router the Worker runs, over the same SQL and migrations,
  against `bun:sqlite` in `.wrangler/state/blobatar-dev.sqlite`. So the landing
  page is the real thing in development: real chunks, real refusals.
  `.dev.vars` is read if present and Cloudflare's published test values are used
  if it is not, so a fresh clone works with no setup.
  - **Two things the dev server does that the Worker does not**, both in
    `server.ts` and neither deployed. It empties the `quota` table before every
    write, because one blob per address per day is the right rule for a wall and
    an unusable one for the person building it — cleared rather than skipped, so
    the placement's own transaction still runs every statement it does in
    production. And it answers `no-store` on every wall response: chunk bodies
    are `immutable` for a year at version-keyed URLs, which a database you reset
    turns into a browser showing blobatars that no longer exist.
  - `rm apps/site/.wrangler/state/blobatar-dev.sqlite` is the full reset — it is
    a scratch database and nothing but the wall is in it.
  - Placement needs a network, because the challenge is verified for real
    against Cloudflare with a secret that accepts any token. There is no bypass
    and there should not be one.
- **`bunx wrangler dev`** from `apps/site` when the question is about Cloudflare
  rather than about the wall — the actual runtime, the actual D1 binding, the
  actual asset pipeline. Needs a build first and one migration run:
  `bunx wrangler d1 migrations apply blobatar --local`.
- `/wall` is the full-screen preview page, against the fixture, and `/?wall=fixture`
  puts that fixture behind the landing page's own section.

## What is built

Everything that decides what is *true* is pure and tested; everything that
touches a browser is not. The Worker imports the first half and none of the
second.

| File | What |
| --- | --- |
| `apps/site/src/wall/geometry.ts` | The rules. Cells, chunks, reach, the empty wall. **Shared with the Worker.** |
| `apps/site/src/wall/camera.ts` | Pan, zoom-about-pointer, the fly-to arc, the off-screen arrow. Client only. |
| `apps/site/src/wall/chunk.ts` | The wire format, its decoder, and occupancy over loaded chunks. |
| `apps/site/src/wall/source.ts` | Fetching: region indexes, chunk bodies, the optimistic claim, `submit`, `findMine`. |
| `apps/site/src/wall/fixture.ts` | A wall that never existed: ~5,000 blobatars, grown rather than drawn. Also the load the renderer is profiled against. |
| `apps/site/src/wall/expressions.ts` | The face roster and the `idle` fallback. |
| `apps/site/src/wall/paint.ts` | Canvas drawing and the sprite cache. Needs a DOM; untested. |
| `apps/site/src/components/WallCanvas.tsx` | Pointer, camera, the live DOM cell, the scrim. Untested. |
| `apps/site/src/components/WallPanel.tsx` | The placement panel and the arrow that points at the cell. |
| `apps/site/src/components/Turnstile.tsx` | The challenge, loaded on demand, invisible-first. |
| `apps/site/src/wall/copy.ts` | The hand-lettered strings. Input to a font subset, not just copy. |
| `apps/site/src/wall/limits.ts` | The name cap, shared with the Worker's moderation. |
| `apps/site/src/components/WallSection.tsx` | **The landing page's second section.** The wall, its heading, the controls. |
| `apps/site/src/components/Field.tsx` | The generated field, now the cold-start backdrop rather than the section. |
| `apps/site/pages/wall.tsx` | The preview page. A development surface, not a destination. |
| `apps/site/worker/wall/db.ts` | Five queries and the D1 types, structural rather than imported. |
| `apps/site/worker/wall/index.ts` | The five routes and their cache headers. |
| `apps/site/worker/wall/moderation.ts` | Length cap, charset, folded blocklist. |
| `apps/site/worker/wall/identity.ts` | Address hashing, the cookie token, constant-time compare. |
| `apps/site/worker/wall/turnstile.ts` | Verification, failing closed. |
| `apps/site/worker/wall/migrations/0001_wall.sql` | Four tables, three of them there to be raced against. |
| `apps/site/worker/wall/sqlite.ts` | D1 as `bun:sqlite` — the tests and the dev server both run the shipped SQL through it. |
| `scripts/wall-profile.ts` | `bun run profile:wall`, against a running dev server. |

`bun test` from `apps/site` — 199 tests, of which the wall's own are
`src/wall/` and `worker/wall/`.

### The endpoints

| | |
| --- | --- |
| `GET /wall/r/<rx>_<ry>` | Version index for a region of 8×8 chunks. 30s. The only repeated request. |
| `GET /wall/c/<cx>_<cy>/<version>` | A chunk body. `immutable` for a year at the current version, `no-store` at a stale one. |
| `GET /wall/mine` | Where the cookie's blobatars are. Reads only. |
| `POST /wall/place` | The write. |
| `DELETE /wall/p/<x>_<y>` | Moderation. Bearer token, constant-time, 404 when unconfigured. |

`/wall/` itself is still the preview *page* and is handed back to the asset
pipeline — `run_worker_first` had to widen to `/wall/*`, so the Worker declines
that one path rather than answering it with a JSON 404.

## What is not built

- **The overview tile.** A v1 item rather than a nice-to-have: a drawing made of
  occupancy is only legible zoomed out, and chunks are the wrong thing to serve
  there. `MIN_ZOOM` is 0.45 only until it exists.
- **Cell addresses (`?at=3_4:512`) and the OG image of a neighbourhood.**
- **The off-screen arrow and the "Find mine" flight** exist in `camera.ts` and
  in the preview page's controls, but the landing-page control with its two
  states (*Add yours* / *Find mine*) is not written.

Three things only Alain can do, and none of them is code:

1. `bunx wrangler d1 create blobatar`, then put the id in `wrangler.jsonc`
   where the `TODO` is. One database for the whole project — the wall's tables
   are simply the first ones in it.
2. A Turnstile widget in the dashboard. The **secret** goes to
   `wrangler secret put TURNSTILE_SECRET`; the **site key** is public and
   per-deployment, and reaches the bundle as `BUN_PUBLIC_TURNSTILE_SITE_KEY`.
3. `wrangler secret put WALL_SECRET` and `WALL_ADMIN_TOKEN`, plus
   `WALL_BLOCKLIST` when there is something to put in it.

Until 1 and 2 are done, `wrangler dev` runs the whole thing locally on
Cloudflare's documented always-passes test keys. There is no bypass in the code
and there should not be one: a deployment with no Turnstile secret refuses
writes rather than accepting them.

## What it costs

`bun run profile:wall` with `bun run site` running. It wraps the page's own
`requestAnimationFrame` before any of its code runs, so what is timed is
`WallCanvas.draw` and nothing else — a frame *counter* would be measuring the
rate the script dispatches synthetic input at, which is a fact about the script.
`rasterised` is `new Image()` calls, one per blobatar turned into pixels.

Against the fixture (~5,000 placements, ~300 cells across), Chrome headless:

| | 1440×900 | 3840×2160 |
| --- | --- | --- |
| first paint | p50 0.9ms, max 26ms | p50 1.1ms, max 103ms |
| pan at zoom 1 | p50 0.5ms, p95 2.2ms | p50 1.1ms, p95 3.9ms |
| pan at `MIN_ZOOM` | p50 0.9ms, p95 3.2ms | **p50 19.1ms, p95 25.3ms** |
| idle, 3s | 0 frames, 0 rasterised | 0 frames, 0 rasterised |
| pan at `MAX_ZOOM` | p50 0.2ms | p50 0.4ms |

Three things worth knowing:

- **Sprites are `ImageBitmap`s, not `<img>`s, and that was worth 3–8×.** The
  source is an SVG data URI, and an SVG-backed image is a *description*: every
  `drawImage` at a new size is a fresh rasterisation. Freezing each one into
  pixels once took the 1440×900 minimum-zoom pan from p50 7.2ms to 0.9ms, and
  the 4K one from 61ms to 19ms. Two things that sound like they would help do
  not, and were measured and reverted: `imageSmoothingQuality = "low"` and a
  smaller `SPRITE_PX`. What is left is per-draw overhead, three thousand times.
- **4K at minimum zoom is the one case over frame budget**, at about three
  thousand blobs a frame. That is precisely the case ADR 0011 gives the overview
  tile to — so this is a number for that decision rather than a bug to fix here.
  It is also where the sprite cache runs past `SPRITE_BUDGET` and holds ~110MB
  of bitmaps, which is the eviction guard behaving correctly.
- **Idle must be exactly zero frames and zero rasterisations.** It was not once,
  and the failure mode was a hundred SVGs rasterised per frame forever on a
  still page. That row is the regression test for it.

## The contracts

**Occupancy is a predicate, plus a separate `populated` flag.** `(x, y) =>
boolean` returning false means "nothing here" to a Worker holding the region and
"nothing fetched yet" to a client, and those must not be confused. The caller
knows which it has; the rules cannot work it out. On the client that flag comes
from the region index's total count, not from the size of the loaded set.

**Nothing is seeded.** The first blobatar is placed by a person and goes at the
origin by rule, which anchors the coordinate system to it. The empty wall is a
real state the rules express, and it lasts exactly one placement.

**The wire format is positional**: `[index, seed, expression, at]`. Slot within
the chunk rather than a coordinate; expression by *name*, never an id into a
table. `at` is whole seconds. `decodeChunk` is defensive about its own shape
because bodies are cached for a year in caches this code cannot reach; a body it
does not understand is discarded, never half-drawn.

**A full chunk can never change.** 1024 of 1024 means frozen forever. Versioning
is the mechanism, fullness is an optimisation on top of it.

**Every rule is a constraint, not a check.** One cell to one person is a primary
key; one blob per address per day is a primary key on its own table. A `SELECT`
then `INSERT` does not survive two Workers arriving at once, and a failed
`INSERT` inside `batch()` — a real transaction — does. This is also why the
tests run against `bun:sqlite` rather than a mock: a mock cannot violate a
constraint.

**The name that is stored is the name that is drawn.** The write path trims and
otherwise refuses; it never rewrites. A server that silently corrected a name
would seed a blobatar from a string nobody typed, on a wall whose entire
argument is that the avatar is a pure function of the string.

## Things that will bite

Each of these cost real time. They are documented at their sites too.

- **Negative zero.** `-0` reaches a cell from three directions and compares
  equal to `0`, prints as `"0"`, and is a different value to `Object.is`, `Map`
  keys and React's key diffing. Everything goes through `cell()` in
  `geometry.ts`. It bit three times before that existed.
- **The sprite cache must never evict what the current frame drew.** It did, at
  a 400 budget with 500 blobs on screen, and each rebuild fired `onload`, which
  asked for another frame. Eviction runs *after* the frame and skips
  `used === frame`.
- **The overlay's position must be set at commit time, not in the rAF.**
  `useLayoutEffect`, before paint.
- **A `draw` callback whose identity changes re-runs the resize effect**, and
  `canvas.width = …` clears the canvas. Props the draw loop reads go through a
  ref — and so does the source, for the same reason.
- **Lightning CSS lowers standalone `translate` into `transform`.** Both must
  ride `transform`. Check the *compiled* stylesheet, not the source.
- **React's `onWheel` is passive** and cannot `preventDefault`.
- **A drag over `DRAG_SLOP` is never a click**, and occupied and empty cells are
  different targets.
- **An optimistic placement must survive the index being stale.** The region
  index is up to 30 seconds behind the write, and for those 30 seconds the body
  at the old version is the wall *without* the blobatar somebody just placed.
  Fetching it would show them their own placement being undone. `source.ts`
  holds the chunk back until the index shows a version past the one it claimed
  at — and then refetches it *forced*, because the optimistic body was numbered
  locally and a version check would take that for a hit.
- **`BUN_PUBLIC_*` is inlined only when it is set.** An unset one survives into
  the bundle as a literal `process.env.…`, and `process` does not exist in a
  browser — so a forgotten variable is a ReferenceError on the page, not a
  fallback. Hence the `typeof process` guard in `Turnstile.tsx`. Visible only in
  the compiled output.
- **The fixture is grown, not drawn, and the density is load-bearing.** Filling
  rings outward produces a solid disc with a ragged edge — a stamp, which is not
  what any rule here produces. Cells are taken by accretion with a hard ceiling
  on how hemmed-in a cell may be (`CROWDED`), which leaves holes at every scale.
  Occupancy is the medium, so a fixture with no holes cannot show what a drawing
  on this wall looks like, and a renderer tuned against a solid field is tuned
  against the one case that never happens.
- **The hand-lettered font is subset to one sentence.** `fonts/caveat-hand.woff2`
  covers exactly the characters in `src/wall/copy.ts` — 8 KB against 47 for the
  Latin cut of the same face. Add a letter to that copy without regenerating and
  it renders in the fallback with no error anywhere; `src/wall/copy.test.ts` is
  what makes that a failing test instead. The command is in `fonts-src/README.md`.
- **The arrow must not land on the cell's name plate.** The canvas draws the
  name under the blobatar, so an arrow approaching from below — which is every
  arrow on a narrow screen, where the panel is a bottom sheet — strikes the name
  through unless it stops further short. Hence the direction-dependent gap in
  `WallPanel`.
- **The canvas is not the viewport any more.** Everything inside `WallCanvas`
  thinks in canvas coordinates, which was the same thing as viewport
  coordinates only while the wall was a full-screen page. In a section halfway
  down the landing page it is not, and the difference is the arrow pointing at
  the wrong cell. The canvas rect is cached and refreshed on resize *and on
  scroll* — a scroll moves the canvas without the wall moving at all, so nothing
  would otherwise redraw and both the overlay and the arrow would be stale.
- **The section must never eat the wheel.** Plain wheel scrolls the page; only
  ctrl+wheel (a pinch) zooms, plus the buttons for people without a trackpad.
  `wheelZooms` turns the old behaviour back on for the full-screen preview,
  where there is no page to protect.
- **The CSS gate moved to 60 KB** when this landed — checked first, not assumed:
  no base64, no surviving at-rules, 9.8 KB gzipped. The failure it exists for is
  five times that. See `build.ts`.
- **A refusal cannot suggest anywhere from the reach box alone.** Somebody who
  aimed far past the frontier has nothing occupied anywhere in that box, so the
  nearest placeable cell computed from it is `null` — the one case where an
  answer would help. The 409 path pays for a second, wider read, bounded rather
  than a scan, so a bot hammering unplaceable coordinates cannot turn each
  refusal into a walk of every row.

## Open decisions

- **The cooldown.** A day is slow enough that nothing may ever form. The honest
  loosenings — a shorter cooldown, or letting people move what they placed —
  were both considered and rejected for v1; if the wall stalls, this is the
  first number to revisit. It is one string (`dayOf`) and one column.
- **Long names.** The field caps at 24 characters and the hover plate truncates
  at 22. The charset now accepts letters, marks and digits in any script, which
  is the right call and also means 24 code points of Devanagari is a much wider
  plate than 24 of Latin. Untested against real names.
- **Placements are not "larger and labelled".** ADR 0011 says the real wall
  renders above the generated field *larger and labelled*, so that what is real
  is visibly the foreground during cold start. Half of that is missing: the
  canvas draws no name under a placement, only the hovered cell does, so on a
  cold-start wall the generated blobs are the labelled ones. Either the canvas
  learns to draw plates at close zoom, or the field gets quieter.
- **The blocklist's false positives.** Matching is substring-based over a folded
  form, so the Scunthorpe problem is present and unsolved. The trade is
  deliberate in this direction — a refused name can be changed, a slur on the
  wall has to be found — but nobody has watched it refuse a real person yet.
- **Reach.** Settled at 32 before the first write, which is the last moment it
  was free. Watch the ratio of placements at the suggested frontier to
  placements out in the quiet, as ADR 0011 says.
