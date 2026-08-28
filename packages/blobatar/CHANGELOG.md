# Changelog

## 2.6.0

### Minor Changes

- 5163644: Add `blobatar/gaze` and `blobatar/gaze.css`: the pointer-driven gaze layer, §4.5 of the motion spec, and the only motion layer with a JavaScript half.
  
  Import the stylesheet once beside `blobatar/motion.css`, set `--mo-track-travel` on the blobatars that should follow the pointer, and run the driver on the `<svg>`:
  
  ```js
  import "blobatar/motion.css";
  import "blobatar/gaze.css";
  import { gaze } from "blobatar/gaze";
  
  const g = gaze(svg, { target: "pointer" }); // g.stop() tears it down
  ```
  
  A driver is armed by construction and aimed by a target. `gaze(svg)` alone watches nothing: the default is `null`, so the layer is running, the eyes are home, and the idle glance is untouched until something asks for them. `lookAt` is the seam that asks, and it takes a point in client coordinates, an element, or one of two words:
  
  ```js
  g.lookAt({ x: caretX, y: caretY }); // a caret, a card, a spot in the viewport
  g.lookAt(button); // an element: its centre, re-read as the page moves
  g.lookAt("pointer"); // the cursor
  g.lookAt("rest"); // its own centre, held: deliberately not looking
  g.lookAt(null); // nothing — the eyes ease home and the idle glance comes back
  ```
  
  `"rest"` and `null` are both "stop looking at that", and they are two different requests: `"rest"` keeps the idle glance stood down so the stillness reads as a face choosing not to look, while `null` hands the blobatar back to its own life with the driver still attached and still watching. Neither is `stop()`, which is teardown and snaps. Passing an element is the one worth reaching for: the driver already re-reads its own box on scroll, resize and its own resizes, so a watched element rides on the same machinery instead of the caller writing those listeners by hand.
  
  Following the pointer is a target like the others rather than what a driver does when nobody said otherwise. That costs one argument at every call site that wants it, and it buys a layer where nothing starts moving implicitly — worth knowing if you set the excursion and see a face that never moves, because that symptom now has two causes and both are visible from the call site.
  
  Nothing changes for anyone who does not import it. `--mo-track-travel` is registered with an initial value of `0px`, so the stylesheet alone resolves to the identity on every blobatar, and the entry is separate from `motion.css` precisely so a page with no pointer driver pays nothing for it.
  
  The driver writes custom properties and never a class, because a class added imperatively races the framework for `className` and loses quietly. It parks its rAF loop once the eyes settle, watches `prefers-reduced-motion` and `(hover: hover) and (pointer: fine)` live rather than sampling them once, and stands the idle saccade down through `--mo-track-hold` so a blobatar does not glance away at random while it is watching you.
  
  The eyes are marks on a sphere, not stickers sliding on a disc. `project` lifts
  each eye onto the unit sphere, rotates it about the face's centre and projects it
  back, so it foreshortens as it turns and cannot pass the limb — asked for more
  excursion than the head is wide, an eye parks at the edge with no width left and
  vanishes into it rather than sliding out over the page. Nothing clips anything:
  there is no `clipPath` and no id, so many blobatars on one page still cannot
  collide.
  
  The head is an ellipsoid fitted to the actual silhouette, not to its bounding
  box, and inset by the eyes' own size. The roster does not agree on one number —
  the largest safe ellipse is 0.98 of the box on `round` and 0.39 on `triangle` —
  so the driver measures it per blobatar on attach, in viewBox units that scrolling
  cannot change. Across 400 seeds and every shape, no eye leaves a silhouette in
  the documented 1.5 to 4 range.
  
  The cues that used to be tuned per stop for the idle glance are consequences
  here. Foreshortening is the cosine of the turned longitude; the eye leading into
  a turn is nearer the limb and compresses harder because that is where it is,
  not because a coefficient says so; and the convergence tilt is the product of the
  two sines, which vanishes on the pure axes exactly where a real face shows no
  tilt. §4.8 of the motion spec is the whole argument.
  
  `travel` is unchanged and still a distance in viewBox units. It is read as an arc
  rather than a slide, and for a small turn the two agree to within a percent, so a
  face at the documented 1.5 to 4 units moves exactly as far as before. Larger
  values now saturate at the limb instead of leaving the head.
  
  `step` and `project` underneath it are the pursuit and the projection as pure
  arithmetic, with no clock and no DOM, for renderers that solve frames out of
  order.
- 27939a5: Export `survey()` and `Face` from `blobatar/gaze`: the fitted head and eye marks the projection turns on, measured off a rendered blobatar.
  
  ```js
  import { project, survey } from "blobatar/gaze";
  
  const face = survey(svg); // { marks, rx, ry } in viewBox units, or null
  const p = project(face.marks[0], travel / face.rx, travel / face.ry);
  ```
  
  This is the measurement `gaze()` already did in its closure, lifted out unchanged. Nothing about the driver's behaviour moves: it calls this and assigns the result.
  
  It is exported because the driver is not the only thing that has to know where an eye rests. `step` and `project` are pure so that a renderer solving frames out of order can use them. `apps/video` integrates its whole pursuit forwards at module load, because the filter is recursive and Remotion hands frames to several workers in arbitrary order. But the projection needs geometry as well as arithmetic, and the fitted ellipsoid is the one input that cannot be derived from a name: it is found by bisection against the rendered silhouette and lands at 0.98 of the box on `round` and 0.39 on `triangle`. Without this, anything not running the driver had to keep a second copy of that fit, which would go on rendering plausibly while the two quietly disagreed about where the limb is.
  
  `survey(el)` takes the `<svg>` and returns `null` for a subtree with no layout box (`display: none`, or detached), which is a blobatar that cannot be looked at anyway. `rx` and `ry` are semi-axes in viewBox units and `marks` are fractions of them, already normalised for `project`, so neither number changes when the page scrolls or the blobatar is drawn at a different size. The marks come back in `querySelectorAll(".mo-eye")` order, which is the order `--mo-gz-*1` and `--mo-gz-*2` are picked apart by.

## 2.5.0

### Minor Changes

- 5591cd9: React Native and Expo adapter.
  
  `@blobatar/react-native` renders through `react-native-svg`, from a new
  `_marks` export on `blobatar/internal`: the figure as drawing primitives
  rather than as markup, because React Native has no `innerHTML` and its
  `<Image>` does not decode SVG, so neither of the existing rendering modes ports.
  
  Additive throughout: a new package, a new `internal` export, nothing renamed or
  removed. `size` is required on this adapter and there is no `animate`, because
  the motion layer is CSS, which the platform does not have. `expression` works in
  full.
- 7b75abe: The idle layer on React Native, on the UI thread.
  
  `AnimatedBlobatar`, from the new `@blobatar/react-native/animated` entry point,
  runs the ambient motion: breathe, bob, blink, the glance and its
  foreshortening, plus the two loops that belong to an expression rather than to
  the ambient layer, `thinking`'s seesaw and `mad`'s tremor. It morphs between
  expressions too, so it is `MorphingBlobatar` with the motion added.
  
  The loops are Reanimated worklets, so a screen full of blobatars animating at
  once costs no React render per frame. `react-native-reanimated` and
  `react-native-worklets` are optional peer dependencies, needed only by that
  subpath: `Blobatar` and `MorphingBlobatar` stay at the package root and link
  neither. The published adapter compiles its own worklets, through a Babel step
  the build now runs and then verifies, because an untransformed `'worklet'`
  directive is an ordinary function that silently runs on the JS thread.
  
  `animate` is a boolean the caller drives, defaulting to false. On the web the
  idle layer is gated on `:hover`, which does not exist on a touch screen, and
  `motion.css` already says so by pausing every loop under `@media not ((hover:
  hover) and (pointer: fine))`. So the only mode this platform has is the
  always-on one, and *when* is a question the app can answer and a component
  drawn into a scroll view cannot. Turning it on or off ramps over 400ms, which
  is the stylesheet's own transition, and lands on exactly the still blobatar.
  
  Core grows `blobatar/idle`: `idleAt` evaluates all seven loops as a pure
  function of elapsed time, and `idleTransforms` composes them onto the nesting
  levels the stylesheet decorates. Its own entry point rather than part of
  `blobatar/internal`, because keyframe tables are array literals, which a
  bundler does not drop the way it drops an unreferenced function.
  
  The loops therefore exist twice, in core and as worklets, since a worklet
  cannot call an imported function. `packages/harness` runs both over a sweep of
  seeds, times and amplitudes and asserts they agree exactly, so a transcription
  error fails CI rather than waiting for a device. The pose composition is not
  duplicated: it stays in core and runs in JavaScript, and the seesaw reaches it
  as an outer translate that composes exactly.
  
  The seeded timings behind the loops now come from one derivation,
  `motionSeeds`, which `motionVars` serializes for the stylesheet and the idle
  layer reads directly. That costs about 60 B on every adapter that animates and
  buys the property the whole motion layer rests on: a blobatar breathes on the
  same offset on both platforms, and a grid is a crowd rather than a heartbeat.
  
  Additive throughout: nothing renamed or removed, and `Blobatar` unchanged.
- 49984b6: Morphing between expressions on React Native.
  
  `MorphingBlobatar` animates the change from one `expression` to the next
  instead of cutting to it, on the same clocks and the same curve the stylesheet
  uses: 300ms adopting an expression, 400ms returning to idle. It takes the same
  props as `Blobatar` and interrupts cleanly, starting from wherever the face
  actually is rather than from the pose it set out from.
  
  A second component rather than a `morph` prop, because a prop on one component
  is reachable whether or not anybody passes it: this way a bundler drops the
  whole 1.1 kB for an app that never names it, and the still `Blobatar` stays
  where it was.
  
  Core grows `_posed` on `blobatar/internal`, the sibling of `_marks` that leaves
  the pose as numbers instead of baking it into the geometry, plus
  `poseTransforms`, `lerpPose` and `fadeHex`. No path data is regenerated during
  a morph. A frame is thirteen numbers and one transform per eye, which is the
  same property the web side has. The pose composition moves from
  `src/expression.ts` into a new `src/morph.ts`, so reaching for it no longer
  drags the fourteen-pose roster into a bundle that imported none of them.
  
  Additive throughout: nothing renamed or removed, `Blobatar` unchanged, and the
  idle layer still absent, because it is a stylesheet gated on `:hover` and this
  platform has neither.

## 2.4.0

## 2.3.1

### Patch Changes

- Document the shadcn/ui registry item, and add `shadcn` keywords so the packages
  are findable from that side.
  
  No runtime change: the READMEs and the `keywords` arrays are the whole diff.
  This is a release because an npm package page is written by a publish and by
  nothing else, so the registry item stays invisible on the two pages most likely
  to be read until one happens.

## 2.3.0

## 2.2.0

### Minor Changes

- 011915a: Adapters are published under their own names: **`@blobatar/react`** and **`@blobatar/vue`**.
  
  Nothing breaks. `blobatar/react` and `blobatar/vue` keep working and render exactly what they always did — the new packages re-export them, so they are the same component and cannot drift. Move when it suits you:
  
  ```sh
  bunx blobatar-codemod .
  bun add @blobatar/react
  ```
  
  The old subpaths are deprecated and frozen, and go in v3. They are also the last two: adapters added from here on are packages only, so `blobatar`'s optional peer list stops growing at `react` and `vue` instead of naming every framework the library ever supports.
  
  Also new: `blobatar/internal` (`_parts`, `_layout`, `serializeVars`), the entry point adapters build against. Its shape changes only on a major, together with every `@blobatar/*` package. It is not a general-purpose API — `blobatar()` and `blobatarUri()` remain the public answers for rendering markup.
  
  No blobatar changes. Faces are byte-identical to the previous release.

What changed, and — where it matters — what it costs to upgrade.

The thing this file exists to state clearly is churn. A blobatar is derived from
a name, so anything that moves the seed → look mapping changes faces that are
already in production, and no other release note in a package like this one is
as important. Releases that move it say so first.

The mapping itself is frozen per **generation**, and the package major selects
one: `blobatar@1` renders gen1, `blobatar@2` renders gen2. See
[ADR-0006](../../docs/adr/0006-generations.md) and
[ADR-0008](../../docs/adr/0008-package-majors-select-generations.md).

## 2.1.0

**No blobatar changes.** Nothing here touches the seed → look mapping: the
golden fixture is untouched, and every entry point that already existed builds
to the same bytes it did in 2.0.0. This release adds a second adapter and
nothing else.

### Added

- **`blobatar/vue`** — a Vue 3 adapter, with the same options, the same two
  rendering modes and the same accessibility handling as `blobatar/react`. A
  static blobatar is an `<img>`; `animate` switches it to inline SVG. Anything
  not declared as a prop — `class`, `style`, `alt`, `data-*`, listeners — lands
  on whichever element the mode renders.

  ```vue
  <script setup>
  import { Blobatar } from "blobatar/vue";
  </script>

  <template>
    <Blobatar name="alain@example.com" :size="48" />
  </template>
  ```

  `vue` is an optional peer dependency, exactly like `react`, and none of this
  reaches you unless you import it: `blobatar`, `blobatar/blob`, `blobatar/uri`
  and `blobatar/react` are unchanged and no larger. Only what lands in
  `node_modules` grows.

  One shape to know: write `:animate="true"` rather than a bare `animate`. Vue
  only casts a valueless attribute to `true` when `Boolean` leads the prop's
  type list, and here `String` does — so `<Blobatar animate />` arrives as `""`
  and reads as off. `"hover"` and `"always"` are the forms worth writing
  anyway.

Thanks to [@FliPPeDround](https://github.com/FliPPeDround) for the adapter.

## 2.0.0

**Every seed renders differently.** gen2's ten silhouettes replace gen1's six,
and a new shape is not additive — it takes its share of the band table from the
existing ones. Roughly a third of names come out byte-identical anyway, because
a round body with room for its eyes is drawn by the same arithmetic under both
vocabularies; the rest move. Stay on `blobatar@1` if that is not acceptable
yet, and upgrade when it is.

### Added

- Four silhouettes: `capsule`, `triangle`, `hexagon` and `droplet`, alongside
  `round`, `organic`, `boxy`, `nub`, `cloud` and `sun`. Weighted rather than
  uniform — round and organic stay the everyday shapes and the louder ones stay
  finds.
- Trait keys for what the new shapes read: `capsule.squat`, `poly.round`
  (triangle and hexagon) and `droplet.tip`. `body.rot` is now read on the
  polygons as well as on a boxy body.
- A trait override can be a **list**: `{ shape: [0.11, 0.825, 0.965] }` means
  "round, cloud or sun — whichever this name comes out as". A number narrows a
  key to one outcome and an omitted key leaves it at all of them; a list narrows
  it to what it names and leaves the seed to choose, which is the case a single
  position could not state. The choice rides on that key's own hash, so it is
  per seed, stable, uniform over the list, and independent of every other trait.
  An empty list is the same as omitting the key.
- `thinking` — a fourteenth expression, and the first whose message is a
  *duration* rather than a shape. It holds two eyes at different heights and,
  with `blobatar/motion.css` loaded, seesaws them on a 900ms cycle: the two-dot
  loader, drawn with the two dots a blobatar already has. Set it while you fetch,
  clear it when you are done.
- Two pose channels behind it, both identity on every existing pose: `edy2`, a
  vertical offset on the right eye, and `rock`, a seesaw amplitude built the way
  `shake` is — an amplitude on a loop that always runs, since an expression is
  held and cannot fire.

### Changed

- `Shape` is the union of the ten silhouette names, and `layout` returns it —
  narrow enough that a typo in a bulk filter is a type error.
- `TraitOverrides` widens from `Record<string, number>` to
  `Record<string, number | number[]>`. It accepts every map that was valid
  before; the only callers a widened value type can break are ones reading
  values back out of a map they were handed.
- Core bundle 3.7 KB → 4.4 KB gzipped, measured as `blob only` in
  `scripts/size.ts`. That is what the four silhouettes and the composition seam
  cost; the React and URI entries move by the same amount. Trait lists are +19 B
  of it, and both are inside the budget the file states.
- `motion.css` is ~95 B gz larger, and that lands on every app that imports it
  whether or not it renders a loading face. It buys a channel rather than a
  pose: a future expression that wants a duration is numbers, not stylesheet.
  See §10 of [the expression spec](./docs/expression-spec.md).
- On touch devices the eye loops of a blobatar *wearing an expression* are no
  longer paused. Idle grids are unaffected — that pause is why they are cheap —
  but a loading face that freezes on every phone is the feature not working.
- **The endpoint's unversioned URLs move too.** `blobatar.dev/avatar/<name>`
  follows the current major and now serves gen2. Pin `?gen=1` before upgrading
  on any URL that must keep its old shapes — a pinned generation is never
  retired, and it is the spelling that earns the year-long immutable cache.

### Removed

- **`blobatar/generation`**, and with it the runtime `generation` option. The
  package major is the selector now: pinning a generation is choosing a major
  and letting the lockfile hold it, rather than passing a value at every call
  site. This keeps historical implementations out of the bundle entirely — a
  gen2 consumer no longer carries gen1's layout to pay for a choice it never
  makes — and it is why the endpoint, which does serve both, depends on the
  frozen majors under an alias instead.
- The `droplet.w` and `droplet.n` trait keys. The droplet's taper is drawn as
  the two tangents from its apex to the body, so how far the apex reaches is
  also how wide its base is and how sharp its point comes out: three knobs that
  could disagree became one that cannot. Only reachable through `traits`
  overrides, and only on a droplet.

### Compatibility

Read the headline first: this is a generation change and seeds move. What
follows is about the rest of the release, none of which moves one further.

- Trait lists, `thinking` and the two pose channels are additive. The channels
  are at their identity on every existing pose, and the golden fixture gained
  rows and changed none.
- `thinking` costs +55 B gz in a bundle that already imports any expression, and
  the same as `happy` on its own.

## 1.0.0

- Stabilised the API at 1.0 and added `blobatar/generation`, making gen2
  available as an opt-in value while gen1 stayed the default for the whole
  major. Removed in 2.0.0, where the major became the selector instead.
- Published through npm's trusted publisher: releases are built and signed by
  the tag-driven `release.yml` workflow with provenance, and the repo holds no
  npm token.
- `blobatar.dev/avatar/<name>` went live — the same renderer as an HTTP
  endpoint, for the `<img src>` case that never wanted a dependency.

## 0.2.0

- Nine more expressions, for thirteen: `idle`, `happy`, `sad`, `mad`,
  `surprised`, `wink`, `sleepy`, `smug`, `unsure`, `scared`, `love`, `shy` and
  `sick`. Each is a value imported from `blobatar/expression`, so a consumer
  who uses none carries none.

## 0.1.0

- First release: deterministic blobatars from any string, the six-silhouette
  gen1 vocabulary, `blobatar/react`, `blobatar/uri`, animation through
  `blobatar/motion.css`, and full trait overrides.
