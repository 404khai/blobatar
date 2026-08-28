# Motion spec

Status: **all five CSS layers built, none reviewed by eye.** Steps 1–7 of §11
are done — packaging, seeded timing, the inline-SVG adapter, blink, breathe,
bob, the hover reaction, and idle saccades. `docs/motion-probe.html` covers the mechanics;
nobody has yet watched the thing move and judged whether it reads well, which is
the next step and the one that decides the numbers. §3's loop model has been
settled against real browsers; see the note there.

Adds an optional idle animation to the `blob` variant: a soft breathe, a bob, a
blink, and an optional gaze-follow. Off by default, hover-triggered when on.

---

## 1. The blocker to resolve first

`src/react.tsx` renders an `<img>` with a data URI. **This cannot be animated on
hover.** Content inside an SVG loaded through `<img>` is a non-interactive,
isolated document: `:hover` never fires inside it, and host-page CSS cannot
reach the shapes.

(CSS animations _declared inside_ the SVG do run in an `<img>` — so an
always-on loop would technically work there. Hover would not. Since hover is the
default trigger, this does not rescue the `<img>` path.)

So an animated blobatar **must render inline SVG**, and the adapter has to switch
rendering mode based on the prop:

| `animate`              | Rendering             | DOM nodes per blobatar |
| ---------------------- | --------------------- | -------------------- |
| `false` (default)      | `<img src={dataUri}>` | 1                    |
| `"hover"` / `"always"` | inline `<svg>`        | ~10–16               |

The `<img>` path stays the default precisely because a list of 400 blobatars is
the case it was chosen for. Animation is opt-in, and opting in costs DOM. Say
this in the README rather than hiding it.

---

## 2. Why hover, not always — and why that is not just taste

Emil's frequency table puts hover effects at "tens of times a day → remove or
drastically reduce." A blobatar grid that breathes continuously is ambient motion
with no purpose, seen constantly. Hover-gating is the correct call on the
framework's own terms, not a compromise.

It also happens to be the performance answer. 400 continuously animating SVGs
means 400 composited layers ticking forever; hover means **one at a time**. The
aesthetic argument and the technical argument point the same way, which is
usually a sign the decision is right.

`animate="always"` exists as an escape hatch for the single-blobatar case — a
profile header, an onboarding screen, a marketing page — where the frequency
argument does not apply.

**On the affordance question:** whether a blobatar is clickable depends entirely
on the use case, so the library takes no position. `animate` is not documented
as "for interactive blobatars only" and nothing warns about it. It is the
consumer's call, and they are the only one who knows.

---

## 3. The loop model — read this before §4

> Expressions — the triggered poses `happy`, `sad`, `mad` — are a separate axis
> and live in [expression-spec.md](./expression-spec.md). They share this
> section's amplitude model and invert §4.1's timing asymmetry on purpose. An
> blobatar can be sad and still breathing.

The idle motion is a **continuous loop**, not a one-shot reaction. Hover does not
start and stop it; hover controls its **amplitude**.

The naive design — add the animation class on hover, remove it on hover-out —
has two failures. It restarts the keyframes from zero every time the pointer
re-enters (Emil's exact warning about keyframes vs transitions), and it cuts the
loop dead mid-cycle on the way out, freezing the body at whatever squash it
happened to be holding.

Amplitude gating fixes both, in pure CSS:

```css
@property --mo-amp {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}

.mo-root {
  --mo-amp: 0;
  transition: --mo-amp 400ms ease-out;
}
.mo-root:hover {
  --mo-amp: 1;
}

.mo-breathe {
  /* Runs continuously. See "Why this runs rather than pauses" below — this
     single declaration is the whole decision, and it is not free. */
  animation: mo-breathe 2800ms ease-in-out infinite alternate;
  animation-delay: var(--mo-phase);
}

@keyframes mo-breathe {
  to {
    transform: scaleX(calc(1 + 0.022 * var(--mo-amp)))
      scaleY(calc(1 - 0.018 * var(--mo-amp)));
  }
}
```

The keyframes never restart, so the loop is always phase-continuous. At
`--mo-amp: 0` every keyframe resolves to the identity transform, so an unhovered
blobatar is oscillating between two poses that are the same pose. Hover eases the
amplitude up; hover-out eases it back down. Nothing starts, nothing stops.

`animate="always"` is the same machinery with `--mo-amp: 1` pinned, ignoring
hover entirely.

### Why this runs rather than pauses — resolved, with measurements

The original design added `animation-play-state: paused` and only ran the
animation on hover, on the theory that idle blobatars should cost nothing. That
depended on an unknown: does a _paused_ animation re-resolve its transform when
a custom property inside its keyframes changes? Probed in Firefox 153 and
Chrome (`amp-probe.html`, four legs — substitution, paused-recalc, ramp,
return):

- **Both engines re-resolve a paused effect.** The architecture was sound.
- **Chrome ramps smoothly while paused** — 57 distinct intermediate values
  across the 400ms transition.
- **Firefox does not.** One step. The pose lands on the correct value at both
  ends but jump-cuts between them, which is precisely the freeze this section
  exists to prevent, wearing a different hat.

So the paused variant works in one engine and jump-cuts in the other. Running
the animation continuously fixes Firefox because a ticking animation
re-substitutes its keyframe `var()` every frame, and it costs Chrome nothing it
was not already paying.

**The decision is one code path, running everywhere.** The alternative — pause
on Chrome, run on Firefox behind `@supports` — buys back idle CPU on the
majority engine and costs two behaviors to maintain forever, on the strength of
a number nobody has profiled. Ship the single path; measure; optimize only if
the measurement says to.

The bill: every idle blobatar now has a live animation rather than a paused one.
At `--mo-amp: 0` the transform is identity and the keyframes are static, so this
should stay on the compositor and stay cheap — but "should" is the word that
just cost us a redesign, so §10 carries a measurement task rather than an
assumption.

**If the measurement comes back bad**, the remaining fallback is to drop the
animation class on `animationiteration` after hover-out, so the loop always ends
on a cycle boundary at the neutral pose and idle blobatars carry no animation at
all. Costs a JS listener per animated blobatar, which is why it is not the default.

`@property` is required for `--mo-amp` to interpolate at all (Chrome 85+,
Safari 16.4+, Firefox 128+). **Safari is still unprobed** — run the same file
there before shipping, and expect its result to matter more than either of the
two already collected.

---

## 4. Motion vocabulary

Four layers, composed. Each is independently switchable so they can be tuned
apart from each other. Every amplitude below is the value at `--mo-amp: 1`.

**Units, before any numbers below.** These transforms apply to SVG elements,
where `transform-box` defaults to `view-box` — so percentages resolve against
the `0 0 100 100` viewport, not against the element, and `transform-origin:
50% 50%` means the viewport center (50, 50). That is _close to_ but not exactly
the body center, which `layout()` jitters by ±1.5 units — so a 2.2% scale about
the wrong center displaces the body by 0.03 units. Invisible. Keep the default
box on the motion groups.

Write translations as `px`, not percentages: a bare number is invalid in a CSS
transform, and on an SVG element `1px` resolves to one unit of the local user
coordinate system — so `translateY(-1.5px)` is 1.5 viewBox units, at any
rendered size. Percentages would work too but resolve against a different box
depending on `transform-box`, which is exactly the ambiguity worth avoiding.

The eye *shape* is the exception: blink needs `transform-box: fill-box` (§4.4),
and that flips percentage resolution on that element to the capsule's own
bounding box. Gaze (§4.5) is specified in user units for the same reason.

The eye *wrapper* is not, and the difference cost a shipped bug. A `<g>`'s fill
box is its children's rendered geometry, so it moves whenever they do — Gecko
recomputes it as blink collapses the capsule inside, which drags the wrapper's
`transform-origin` with it. An idle wrapper's transform is the identity and does
not care; a posed one carries the pose's anisotropic scale and turns that shift
into ~30 viewBox units of travel, out and back, every blink. So the wrapper
keeps `transform-box: view-box` and takes an explicit `transform-origin` — the
eye's own centre, in user units, emitted per eye by the renderer. Check H of the
composition gate holds this.

### 4.1 Hover reaction — a transition, not a keyframe

The element the pointer arrives at should respond immediately.

```
scale: 1 → 1.04
translateY: 0 → -1.5px  (= 1.5 viewBox units, see above)
enter: 220ms cubic-bezier(0.23, 1, 0.32, 1)
exit:  160ms cubic-bezier(0.23, 1, 0.32, 1)
```

Transitions, not keyframes — a pointer sweeping across a grid retargets
constantly, and keyframes restart from zero on every re-entry. Exit is faster
than enter: the user is deciding on the way in, the system is responding on the
way out.

### 4.2 Breathe — the idle loop

```
transform: scaleX(1.00) scaleY(1.00)  ↔  scaleX(1.022) scaleY(0.982)
duration: 2800ms
easing:   ease-in-out
iteration: infinite alternate
```

Non-uniform on purpose. Uniform scale reads as a zoom; a slight
squash-and-stretch reads as something soft holding air. It is the cheapest way
to get the "soft" quality without touching path data (see §8).

### 4.3 Bob

```
translateY: 0 ↔ -1.1px
duration: 3400ms      (deliberately not a multiple of the breathe period)
easing:   ease-in-out
iteration: infinite alternate
```

Coprime-ish periods so breathe and bob drift in and out of phase instead of
locking into a single obvious pulse.

### 4.4 Blink — the highest-value one

A face that blinks reads as alive at a fraction of the cost of everything else
here. Worth building first if the budget only allows one.

```
eye scaleY: 1 → 0.08 → 1
duration:   ~140ms   (see below — it is a percentage, not a constant)
easing:     ease-out
interval:   3.5s–6.5s, seeded per blobatar
```

**How the interval is actually built.** There is no CSS mechanism for a short
event on a long seeded period: keyframe percentages are static, and only
`animation-duration` can read a custom property. So the animation runs for the
whole interval and the blink is a narrow window inside it:

```css
.mo-eye {
  animation: mo-blink var(--mo-blink) linear infinite;
  animation-delay: var(--mo-blink-phase);
}

@keyframes mo-blink {
  0%,
  97.2%,
  100% {
    /* open */
  }
  98.6% {
    /* closed */
  }
}
```

The consequence: the blink's real duration is 2.8% of the interval, so it ranges
from ~95ms at a 3.5s period to ~180ms at 6.5s. That is a drift, not a bug — a
slower blinker reading as slightly sleepier is a feature, and 140ms was a
midpoint rather than a threshold. Accept it. The alternative — three or four
pre-authored keyframe sets selected by class — buys precision nobody can see and
triples the CSS.

Do not omit `--mo-blink-phase`. Without it every blobatar's blink window sits at
the same offset in its own cycle, and while the periods differ, a fresh grid
still opens with a visible synchronized flutter before they drift apart.

**Critical:** each eye must scale about _its own_ center. Applied to a shared
group, the eyes slide toward the group center instead of closing. Requires
`transform-box: fill-box; transform-origin: center` on each eye **path**. Not on
the wrapper around it — a container's fill box follows the shape it holds, which
is the origin-drift bug described under Units above.

Blink is discrete, so amplitude gating works differently from the continuous
layers: fold `--mo-amp` into the closed scaleY so that a blink frozen by
hover-out re-opens as the amplitude eases to 0, rather than leaving the blobatar
with its eyes shut. Roughly a 3% chance per hover-out otherwise — rare enough to
miss in testing, common enough to ship.

### 4.5 Gaze follow — optional, separate entry point

Eyes translate toward the pointer, capped at ~1.2 user units, spring-driven.

```
{ stiffness: 120, damping: 14 }   // or Apple form: { duration: 0.5, bounce: 0.15 }
```

Binding position directly to the pointer feels mechanical; a spring gives it
momentum. This is the one layer that needs JavaScript, so it ships as
`blobatar/motion` rather than being folded into the CSS.

Ship it last. The first four layers are pure CSS and carry most of the effect.

### 4.6 Saccades — idle glances

Added after the first five layers, and worth more than §4.5: a face that looks
around reads as _thinking_, where blink only reads as _alive_. It is also pure
CSS, which gaze-follow is not.

```
fixations: six around the compass + center, per cycle
offsets:   fractions of seeded --mo-look-x (1.0–2.2) / --mo-look-y (0.8–1.7)
period:    4.2s–7.6s, seeded, independent of the blink period
holds:     ~15% of the cycle each
jumps:     1.5% windows (~90ms at 6s), linear
```

**Eyes jump; they do not drift.** Real saccades are ballistic — under a tenth of
a second between fixations, then a long hold. Easing this the way breathe is
eased produces floating eyeballs, which is unsettling in a way that is hard to
name and immediate to feel. This is the single decision the layer lives or dies
on.

**Both eyes move as one.** Independent movement is a lazy eye instantly. The
transform goes on the existing `<g fill={eye}>` group — which already existed to
share a fill — so blink stays on the individual paths underneath it and the
markup gains one class, not one element.

**Each fixation is its own direction, not a scaled copy of one vector.** The
first cut multiplied a single seeded `(x, y)` by different fractions, which
meant every blobatar slid back and forth along one axis — technically animated,
visibly on a rail. Six independent compass offsets is what makes the eyes read
as roving.

**The order is not a clock sweep.** center → up-left → right → down → up-right →
left. Walking the compass in order reads as a mechanism rather than as
attention.

**Direction has to be seeded, not just phase.** One shared `@keyframes` walks one
_sequence_, so without per-blobatar direction the whole grid looks left, then up,
then right together. That is worse than the unison problem in §5, because a
sequence is more legible than a phase. `--mo-look-x/y` carry magnitude and sign
drawn separately, so no seed lands near zero, the pattern mirrors into four
orientations, and all four quadrants appear across a grid.

The mirroring is the honest limit of the pure-CSS approach: four orientations of
one order, varied by period and phase. More would mean several `@keyframes` sets
selected by a seeded class, at roughly 200 B each. Revisit only if a real grid
reads as choreographed.

**Uses the `translate` property, not `transform`**, leaving `transform` free on
that element for §4.5 to claim later. The two layers target the same group and
would otherwise fight over one property.

**Eyes may cross outside the body silhouette**, and nothing clips them. That is
deliberate: an eye riding past the edge reads as a face turning on a round head.
Clipping to the body would read as 3D too — arguably better — but it needs a
`clipPath` with an id per blobatar, and "emits no ids, so many blobatars on one page
cannot collide" is a guarantee with a test behind it. Not worth trading.

That holds for the idle rove, whose amplitude is under two units and which never
gets near the edge. It did **not** hold for the gaze, which is deliberate, large
and pointed by a person: asked for an excursion wider than the face, the
translate slid both eyes out over the page. §4.8 is the answer, and it is not a
clip.

**It is close to invisible at 40px.** Even a 2 unit glance is under a pixel at
grid size; translation has no relative-change advantage the way a collapsing eyelid
does. This layer earns its keep on the `always` / profile-header case. Do not
inflate the amplitude to make it show up in a grid — that trades the one place
it works for the one place it cannot.

---

### 4.7 Wrap — the eyes as marks on a sphere

Rides §4.6's windows exactly: same period, same phase, same jump fractions, so
the shape change lands on the frame the move does. A wrap lagging the translate
by even one window reads as the eyes deforming _after_ they arrive, which is
worse than not having it.

Three cues, in descending order of how much work they do.

**Foreshortening** — a glance sideways compresses both eyes on X, a glance up or
down compresses both on Y. This is most of the effect, and the only one that
would be worth keeping alone. It reads `--mo-look-mx/my`, the _unsigned_
magnitudes, because how far a feature foreshortens depends on how far the face
turned, not which way it turned. Those two variables exist only for this: CSS
`abs()` did not reach Safari until 17.2.

**Differential** — the eye leading into a turn sits nearer the limb and
compresses harder than the trailing one. Signed, against each eye's own
`--mo-wrap` side. Its coefficient stays under half the shared one at every stop,
which is what keeps the sum below 1; an eye _growing_ on a glance is the tell
that kills the sphere read instantly. There is a test on that inequality.

**Tilt** — and this is the part worth being pedantic about, because the obvious
implementation is wrong. Rolling a capsule is not what a rotating eye does: a
real eyeball yawing in its socket does not change the iris's tilt. Rotation reads
as the _head_ turning, and hanging a head-turn on saccade cadence gives six of
them in six seconds, which reads as a nervous bird rather than as depth. The
honest term is the one a sphere actually produces: features off the centre
meridian converge toward the pole, so the tilt is the product `x·y`, in
**opposite** directions per eye. It vanishes on pure horizontals and verticals,
where a real face shows no tilt either. A shared roll is the version that looks
like a mistake; the differential is the version that looks spherical.

**Peaks are 7.0% on X, 4.6% on Y, and 2.4°**, against the static per-blobatar lean
capped at 12° in `layout()`. That ceiling is the constraint and not a
coincidence: lean carries identity, so an animated tilt approaching it stops
decorating the blobatar and starts overwriting who it is. Treat 12° as the number
to stay well under if either range is ever retuned.

**On `.mo-eye`, not `.mo-eyes`.** The two eyes must differ, which rules out the
shared group. That puts wrap on the same element as §4.4, so the two run as a
two-value `animation-*` list: blink on its own seeded period, wrap reading
`--mo-saccade`/`--mo-saccade-phase` so it stays locked to the parent. They are
frame-exact because they are literally the same expression, not because their
periods are close. They claim different properties too — `transform` for blink,
`rotate`/`scale` for wrap — so neither overwrites the other.

**Per-eye sign ships as `style="--mo-wrap:±1"` on each path.** Sixteen bytes and
no ids, which the no-collision guarantee depends on; a class per side would also
work and cost a selector. This is the one place the static markup gains a `style`
attribute, and only when `animate` is set — the "static output is untouched" test
covers that.

**The keyframes are written out per stop, not factored.** Both obvious cleanups
measure _worse_: hoisting the chains into custom properties on `.mo-eye` cost 11
gzipped bytes, and animating registered coefficients cost 27, because six
identical chains are nearly free under gzip while six unique short names are not.
Measure before factoring here.

**Budget.** No form of this layer fit the 800 B ceiling — foreshortening alone
measured 854 — so §10 moved to 950 B. That is the right trade in this file and
nowhere else: the stylesheet is paid once per app, so ~180 B buys a 3D read that
per-blobatar markup could never afford.

**Also close to invisible at 40px**, for the same reason §4.6 is: foreshortening
a 3px eye by 7% is sub-pixel. Same rule applies — do not inflate it to make it
show up in a grid.

---

### 4.8 Projection — the gaze on the same sphere

§4.7 is the idle glance's sphere and it cannot be pointed anywhere: its input is
which of six fixations the saccade is in, not a direction. The gaze's input is a
continuous unit vector, so its cues have to be a continuous function of it — and
once they are a function there is no reason for it to be a fitted one.

**The excursion is an arc, not a translation.** `travel` is still a distance in
viewBox units and still means what the READMEs say, but it is read as an arc
along the surface: the turn is `travel / radius` radians, and a mark lands at
`sin` of where it turned to. For a small turn `sin θ ≈ θ`, so a face at the
documented 1.5 to 4 units moves as far as it did when this was a translate. That
compatibility is what kept `travel` a distance instead of forcing it to become an
angle, and `test/gaze.test.ts` pins it.

**And that is what stops an eye leaving the head.** The mark is lifted onto the
unit sphere, rotated as a vector and projected, so `x² + y² ≤ 1` holds by
construction and it arrives at the limb with no width. The 3D read §4.6 wanted
from clipping, without the `clipPath`, without the id, and with the no-ids
guarantee untouched. Gate J in the probe measures it at eight times the
documented excursion.

**A rotation, not two angles.** The first cut clamped a longitude and a latitude
independently, which is a square and not a sphere: a diagonal aim drove both to
their limits at once and put the mark at the *corner*, `√2` out on a disc of
radius 1. The eyes behaved perfectly on the axes and left the head on every
diagonal, which is exactly how it looked.

**Pitch is signed against the screen.** SVG's y grows downward, so the textbook
right-handed rotation about X inverts the vertical and a pointer below the face
makes it look up. There is a test on all four directions, because every other
property in this section — containment, foreshortening, the differential — holds
just as well upside down.

**The head is an ellipsoid fitted to the silhouette, not to its box.** Three
things in turn, each found by a shape that broke the one before:

- *Per axis.* `capsule` is 37 units wide and 20 tall, and one mean radius put its
  limb 44% below the eyes it was meant to contain, so the eyes rode out under the
  chin.
- *Fitted, not assumed.* The box is not the head either: `capsule` is a stadium
  an ellipse overflows at the ends, `triangle`'s box is mostly not triangle, and
  `round`'s per-point radii dip 15% below its widest. The driver bisects sixteen
  rays against `isPointInFill` on attach, in viewBox units a scroll cannot
  change. The answer runs from 0.98 of the box on `round` to 0.39 on `triangle`,
  which is why it could not be a constant.
- *Inset by the eyes.* A centre inside the silhouette is not an eye inside it
  when the eye is a capsule 22 units tall. The foreshortening removes width
  radially as the mark nears the limb and leaves it tangentially, which is the
  direction that overhangs.

Shrinking the head rather than clamping the eye afterwards is what keeps this a
projection: the turn is `travel / radius`, so a smaller head turns further for
the same excursion and a small glance moves exactly as far as it did. Only the
saturation comes sooner, which is correct, because there is less head to turn.

**A mark parks at the edge, it does not go round the back.** Rotating far enough
carries a feature out of sight, which is true of a head and wrong here: the
excursion is a stylesheet's to set and nothing stops it being set to more head
than there is. `triangle`'s fitted head is 9 units tall, so an excursion of 24 is
a pitch of 159°, and the eyes do not turn away — they vanish. A face that blinks
out of existence because someone typed a large number is not a failure anyone can
read, so the projection stops at `LIMB`, 0.97 of the disc, where the eye is down
to about a quarter of its width and still on screen.

**The driver re-resolves a replaced subtree.** The adapters hand `parts.inner`
to `dangerouslySetInnerHTML` and the geometry varies with the *name*, so a
keystroke rewrites the whole subtree while the `<svg>` survives and the callback
ref never fires. A driver holding the old `.mo-eyes` then writes into a detached
tree forever and the eyes never move again — the hero of `blobatar.dev` after one
keystroke. A connectivity check per frame buys the geometry back, and the write
cache has to be dropped with it or the first write to the new eyes never clears
its threshold. Gate J replaces the subtree and measures that the gaze recovers.

**Measured across the roster**, 400 seeds × 10 shapes × 36 directions: no eye
leaves any silhouette anywhere in the documented 1.5–4 range, and no eye is ever
thinner than a quarter of its width at any excursion up to 200. Past it the worst
is about one unit on `capsule`, and `triangle` is the standing exception — its
fitted ellipse does not contain its own eyes, so the head is opened up to hold
them and containment there is a margin rather than a proof. An eye that reaches a
corner late beats every eye frozen from the first frame.

**Every cue §4.7 lists by hand falls out.** Foreshortening is the cosine of the
turned longitude. The differential is the two eyes sitting at different
longitudes, so the leading one is nearer the limb and compresses harder with no
coefficient arranging it — and no test on the inequality, because it is not an
inequality any more, it is where the eyes are. The tilt is the product of the two
sines, which vanishes on the pure axes for a mark on the equator exactly as §4.7
requires, and does not for one above it, because a sphere says so.

**Foreshortening is capped at 1, and that is the one place the geometry is
overruled.** Un-dividing is symmetric: an eye turning *toward* the centre
meridian un-foreshortens and should widen, by up to 11% on the hero's eye
spacing. A real head does that. §4.7 says an eye growing on a glance is the tell
that kills the sphere read instantly, and watching it, §4.7 is right. So the
drawn width is taken as the mark's widest and this only ever removes width.

**It lands on `motion.css`'s own properties**, because there are none left free:
`.mo-eye` spends `translate`, `rotate` and `transform` on the expression, and
`.mo-eye > *` spends `transform` on the blink and `scale`/`rotate` on §4.7. So
`gaze.css` restates those three declarations with the gaze's terms folded in,
which is why it must be loaded after `motion.css`. The offset rides `translate`
rather than the child's, since the individual properties resolve `translate`
before `scale` — on the child it would sit inside the foreshortening and slide
the eye back toward the middle of the face as it turned away.

**Peak tilt is 4.1°**, against §4.7's 2.4° and the static lean's 12° ceiling.
Higher than the idle glance's deliberately: this is a look held for as long as
the pointer is there, where that one is gone in 200ms, and the cue has time to be
read.

**The driver reads the geometry off the DOM.** `getBBox` on each eye and on the
body group is what `layout()` already put there, so the layer costs nothing in
markup: a per-eye custom property would be two more declarations on every
animated blobatar on the page, gazing or not, to say something the driver can
see. The cost is instead a `remeasure()` after any change to `travel`, because
the angle is cached — which is what `useGaze` does for you.

---

## 5. Seeded phase offsets — do not skip this

A grid where every blobatar breathes in unison does not read as a crowd of
creatures. It reads as a heartbeat, or a drill team. It is the single most
likely way for this feature to look worse than no animation at all.

Fix: derive the phase from the seed and emit it as a CSS custom property.

```ts
// Negated at the source. Emitting the positive value is the one mistake this
// section exists to prevent, so do not leave the sign to the caller.
const phase = -t.num("motion.phase", 0, 2800); // ms
const bob = -t.num("motion.bob", 0, 3400); // ms
const blink = t.num("motion.blink", 3500, 6500); // period
const bph = -t.num("motion.blinkPhase", 0, blink); // ms
```

```html
<svg
  style="--mo-phase:-1740ms; --mo-blink:5.2s; --mo-blink-phase:-3100ms"
></svg>
```

```css
.mo-breathe {
  animation-delay: var(--mo-phase);
}
```

Negative delays start the animation mid-cycle immediately. A **positive** delay
postpones the start instead — and because the animation sits `paused` until
hover (§3), the delay clock does not run either, so a positive value buys up to
2.8 seconds of a hovered blobatar doing nothing at all. Same keystroke, opposite
behavior, and it only shows up on first hover.

Breathe and bob need independent phases. Sharing one offset preserves the drift
between the two periods but locks every blobatar into the same drift, which is the
grid-wide pulse this section is about, one level up.

**This costs nothing in compatibility.** Trait keys are string-addressed, so
adding `motion.phase` and `motion.blink` cannot perturb any existing blobatar —
which is exactly the property the keyed-stream design was built for. Confirm
with the existing `trait independence` test.

---

## 6. Delivery: one stylesheet, not inline `<style>`

Inlining a `<style>` block per SVG is simpler DX but duplicates the same
keyframes N times — roughly 80KB of redundant CSS across a 400-blobatar grid.

Ship `blobatar/motion.css` instead. The consumer imports it once; each SVG
carries only class names and two custom properties.

```ts
import "blobatar/motion.css";
```

Document the import as required. A silently non-animating blobatar because someone
missed a CSS import is a bad first experience — consider a dev-only warning if
the stylesheet is absent.

### 6.1 `package.json` changes — the import does not survive without these

`"sideEffects": false` is currently set. That is a standing promise to bundlers
that no module in this package does anything but export values, which licenses
webpack and Rollup to **delete `import "blobatar/motion.css"` outright**. The
result is the silently-non-animating blobatar above, except it happens to everyone
who ships through a bundler rather than to the one person who forgot a line.

```jsonc
{
  "sideEffects": ["*.css"], // was: false
  "exports": {
    // …existing entries…
    "./motion": "./src/motion.ts", // gaze follow (§4.5)
    "./motion.css": "./src/motion.css",
  },
}
```

`"files"` is `["dist", "src"]`, so `motion.css` must live under `src/` (or be
emitted into `dist/` by the build) or it will not be in the published tarball —
a failure that never reproduces locally, only after `npm publish`.

---

## 7. Required markup changes

`src/styles/blob.ts` `render()` currently emits two sibling groups. Motion needs
a nesting layer so hover-scale and breathe compose instead of overwriting each
other (one `transform` property per element).

```html
<g class="mo-root">
  <!-- hover reaction: scale + lift -->
  <g class="mo-breathe">
    <!-- idle loop: squash/stretch -->
    <g class="mo-bob">
      <!-- idle loop: vertical drift -->
      <g fill="…">…body + petals…</g>
      <g fill="…">
        <g class="mo-eye"><path /></g>
        <!-- wrapper: the pose, as plain declarations -->
        <g class="mo-eye"><path /></g>
        <!-- shape: blink and wrap, in keyframes -->
      </g>
    </g>
  </g>
</g>
```

Classes are emitted **only** when `animate` is set, so the static path keeps its
current byte count exactly.

The breathe and bob wrappers belong inside `style.render()`, not in
`makeBlobatar`. The backdrop `<path>` is handled separately in `src/render.ts`,
because wrapping at that level would breathe the plate along with the body.
`blob` defaults to no backdrop, so this is invisible until someone passes
`background: "circle"` — which is exactly the kind of thing that ships.

**`.mo-root` is the exception, and it is the caller's.** Its class is the one
piece of markup that varies at runtime — `mo-expr` goes on and off with the
expression — and anything that varies inside the innerHTML string costs the
morph outright. See §1 of
[expression-followups.md](./expression-followups.md) for what that failure
looks like; the short version is that React replaces the subtree, a fresh
element has no previous computed value, and a transition cannot run on one. So
`makeParts` returns the root class as `cls` and the adapter renders the element.

### 7.1 The React adapter

`BlobatarProps extends ImgHTMLAttributes<HTMLImageElement>`. The inline path needs
`SVGProps<SVGSVGElement>`, so the public prop type becomes a union discriminated
on `animate` — a consumer passing `onLoad` should stop type-checking when they
turn animation on, because it stops firing.

```ts
type BlobatarProps =
  | ({ animate?: false } & BlobatarOptions & Omit<ImgHTMLAttributes<…>, "src">)
  | ({ animate: "hover" | "always" } & BlobatarOptions & SVGProps<SVGSVGElement>);
```

`blobatar()` returns markup as a string, so the inline branch renders the body
through `dangerouslySetInnerHTML` on an `<svg>` the adapter writes itself,
carrying `viewBox` and the seeded custom properties as a `style` object. That
means `render()` needs to be reachable without the surrounding `<svg>` — hence
`makeParts`, rather than the adapter regex-stripping the outer tag.

The split runs one level deeper than the `<svg>`, and the extra level is
load-bearing. `makeParts` returns four things — `cls`, `bg`, `inner`, `vars` —
and only `inner` goes through `dangerouslySetInnerHTML`. The root class, the
backdrop and the `<title>` are all real React elements or attributes, so a
change to any of them is an attribute write rather than a subtree rebuild. Two
consequences worth stating, because both were learned the hard way:

- `<title>` names the element it is the first child of, so it must be a child of
  the `<svg>`; the backdrop must be a sibling of `.mo-root`, not a descendant,
  or the plate hover-lifts with the creature.
- The `{__html}` object must be **memoized on the string**. React compares props
  by reference and re-assigns `innerHTML` for any new object, byte-identical
  content or not — which rebuilds the subtree and kills the morph just as
  effectively as changing the markup would.

This is the bulk of the implementation work and none of it is CSS. Budget for it
accordingly.

### 7.2 The Vue adapter

`blobatar/vue` renders the same two modes with the same `makeParts` split — `cls`
and `vars` on the outer element, `inner` through `innerHTML` on the root `<g>`.
Two React-specific memoizations do not carry over, because Vue's reactivity
replaces them:

- The serialized dependency string (`JSON.stringify([seed, opts, animate])`) is
  unnecessary: a `computed` tracks each prop it reads individually, which is
  the granularity the single string was approximating.
- The memoized `{__html}` object is unnecessary: the VNode diff compares prop
  values, so a byte-identical `innerHTML` is never rewritten and the DOM below
  the root survives an expression change — the same property React needs the
  memo to fake.

The `<title>`, backdrop and root class are still real children/attributes
(never part of `inner`), because the geometric argument — the plate must not
lift with the creature, `<title>` must name the `<svg>` — is framework-neutral.

Two things Vue adds that React does not, both of which the adapter has to
undo rather than adopt:

- **The props table can invent values.** A prop whose declared type list
  contains `Boolean` is cast to `false` when the caller omits it, and the
  adapter would forward that into `BlobatarOptions` as a deliberate choice.
  Every prop therefore declares `default: undefined`, so an omitted option
  stays omitted and the core remains the only place a default is written down.
- **Caller attrs must land last.** `inheritAttrs` is off because the two modes
  render different elements, so each branch merges by hand — and it merges in
  React's order, with `attrs` spread after the values derived from props. The
  other order silently drops a caller's `role` or `width` instead of letting it
  override, and makes the two modes disagree with each other.

`test/adapters.test.ts` pins both, by rendering the two adapters against the
same props and comparing, and by asserting the resolved props table injects
nothing the caller did not pass. The second check exists because the first
cannot see it: the injected `background: false` matches what the `blob` style
already defaults to, so it renders identically until some style ships a
backdrop.

---

## 8. Considered and rejected

**Animating the blob path data.** Morphing `radii` frame by frame would give a
genuinely wobbly body, and the Catmull-Rom generator makes it easy. Rejected:
path interpolation runs on the main thread every frame, which throws away the
main performance property of the CSS approach — animations that stay smooth
while the page is busy loading. Non-uniform scale gets ~80% of the read for 0%
of the main-thread cost.

**Rotating the sun's petal ring.** Tempting and cheap. Rejected for now: it
draws attention to one shape out of six, breaking the sense that all blobatars
belong to the same family. Revisit as a deliberate per-shape motion vocabulary
if that is ever wanted.

**Bounce on hover-in.** Keep bounce ≤ 0.2 if used at all. A blobatar grid is not
a playful drag interaction, and 400 bouncy elements is a toy, not a product.

---

## 9. Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .mo-root,
  .mo-breathe,
  .mo-bob,
  .mo-eyes,
  .mo-eye,
  .mo-eye > * {
    animation: none;
    transition: none;
  }
}
/* Every ambient value lives in a keyframe and every pose value in a base
   declaration, so `animation: none` removes exactly the first set. The pose
   survives at full strength — it is a message, not decoration. */

/* Touch devices fire hover on tap and hold it until the next tap elsewhere —
   a tapped blobatar would sit there breathing. Neutralize, do not just comment. */
@media not ((hover: hover) and (pointer: fine)) {
  .mo-root:hover {
    --mo-amp: 0;
  } /* defeat the hover rule, keep amplitude at rest */
}
```

Amplitude is the only gate now (§3), so neutralizing hover means overriding
`--mo-amp` and nothing else — do not reach for `animation-play-state` here, as
an earlier draft of this spec did. The animations keep running at zero
amplitude exactly as they do for any unhovered blobatar on desktop.

`animate="always"` deliberately survives this block — it is not hover-triggered,
so the tap-latching problem does not apply to it. Scope the overrides to the
hover selectors only, and check this on a real touch device rather than in
devtools emulation, which reports `hover: hover` more often than not.

**What shipped went further, and the paragraph above is the reason it had to be
careful.** Having pinned the amplitude to zero, `motion.css` also pauses the
loops here — `animation-play-state: paused` on `.mo-root:not(.mo-always) *` —
because at amplitude zero every one of them can only resolve to the identity, and
a grid of sixty blobatars was spending 6.7s of style and layout in a Lighthouse
trace to compute that. Paused rather than removed, so the pose a blobatar holds is
the one it already had.

That is safe for everything gated on `--mo-amp` and wrong for anything not gated
on it. The seesaw (§5.3 of the expression spec) is the first such loop: it
carries a message rather than ambience, so pausing it freezes a loading face on
every phone. `.mo-root.mo-expr:not(.mo-always) .mo-eye` runs it back, scoped so
that an idle grid — the case the pause exists for — still pays nothing.

Reduced motion here means **fully static**. Emil's "gentler, not zero" guidance
applies to motion that aids comprehension; this motion is purely decorative, so
removing it costs the user nothing.

---

## 10. Budget and acceptance

| Entry                        | Budget (gz)                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blobatar/motion.css`       | 950 B — **at 923 B with seven layers in.** Was 700, raised to 800 for saccades (§4.6) and to 950 for wrap (§4.7). Raise it again rather than shaving comments out of the stylesheet; this file is paid once per app. |
| `blobatar/gaze` (gaze JS) | 2200 B — **at 2129 B.** Raised from 1250 for the spherical projection below, and again for fitting the head to the silhouette rather than to its bounding box. Was estimated at 900 before it was written, under the entry name `blobatar/motion`. Three things the estimate predated account for the difference and all three are load-bearing: live media queries rather than a single sample, so reduced motion turned on mid-session detaches the driver; the `--mo-track-hold` channel, so the idle rove cross-fades out instead of being hard-zeroed by every host; and reading `--mo-track-travel` back off the element, so the excursion has one home. |
| `blobatar/gaze.css` | 450 B — **at 432 B.** Raised from 300 for the projection, which restates three of `motion.css`'s declarations because `.mo-eye` has no free transform property left. Separate from `motion.css` because it is the one layer a page can decline, and folding it in would raise the budget everybody pays. |
| Static output byte count     | **unchanged**                                                                                                                                                                                                        |
| `blob only` JS               | **unchanged**                                                                                                                                                                                                        |

Only the first two are `scripts/size.ts` entries, and one of them needs a new
code path: every existing entry builds a synthetic TS consumer through
`Bun.build` and gzips the output, which is not how you measure a stylesheet.
Either add a `kind: "css"` branch that gzips the file directly, or let
`Bun.build` bundle a `.css` entrypoint and measure that — the latter keeps one
pipeline and also catches a syntax error in the CSS.

The bottom two rows are not budgets at all. "Static output byte count unchanged"
is a snapshot assertion in `test/blobatar.test.ts`, and "`blob only` JS unchanged"
is the existing 3600 B entry continuing to pass. Both matter; neither is a new
line in the size script.

Acceptance criteria:

- [ ] Static (`animate` unset) markup is byte-identical to today's output.
- [ ] `motion.phase` / `motion.blink` do not perturb any existing trait.
- [ ] Phase offsets are well distributed — no clustering (assert bucket spread
      over 1000 seeds, same shape as the existing avalanche test).
- [ ] Reduced-motion emits no animation classes, or they are fully neutralized.
- [ ] Each eye blinks about its own center, not the group's.
- [ ] Hover in and out repeatedly across a grid: no jump, no restart-from-zero.
- [ ] Hover-out never freezes a pose — body returns to neutral, eyes re-open.
- [ ] **Measure idle cost and write the number here.** 400 blobatars, nothing
      hovered, animations running at zero amplitude. Record CPU and whether the
      transforms stayed off the main thread (DevTools → Rendering → Frame
      Rendering Stats / Layers). This replaces the old "0% CPU" criterion, which
      the §3 decision made unachievable. If it lands above ~3% on a mid laptop,
      take the `animationiteration` fallback in §3.
- [ ] Same measurement with one blobatar hovered — the 400ms amplitude ramp forces
      keyframe re-substitution and is the one moment the main thread is involved.
- [ ] `motion.css` survives a production bundle — build a webpack or Vite
      fixture that imports it and grep the output for `mo-breathe`. The
      `sideEffects` change in §6.1 is untestable from inside this repo.
- [ ] Blink phases are offset, not just periods — a fresh grid does not open
      with a synchronized flutter.
- [ ] Tapping a blobatar on a real touch device leaves it static.

---

## 11. Build order

0. ~~Verify the loop model in a scratch file.~~ **Done.** Chrome and Firefox
   both re-resolve a paused effect, but Firefox will not interpolate one, so the
   loop runs continuously instead of pausing on hover-out. See §3. Re-run
   `amp-probe.html` on Safari before shipping; it is the one engine with no
   result yet, and it has historically been the weakest of the three at
   `@property`.
1. ~~Packaging (§6.1).~~ **Done.** `sideEffects: ["*.css"]`, the `./motion.css`
   export, `src/motion.css` carrying the amplitude machinery and the a11y rules,
   demo imports it.
2. ~~Seeded timing (§5).~~ **Done.** `src/animate.ts`, negated at the source,
   with `test/motion.test.ts` asserting sign, spread and independence.
3. ~~The inline-SVG adapter and markup (§7, §7.1).~~ **Done.** Prop union,
   `makeParts`, the nested `<g>` wrapper, `mo-eye` on each eye. Demo has an
   animate selector that routes the grid through the real adapter.
4. ~~Blink (§4.4).~~ **Built, unreviewed.** `.mo-eye` with `transform-box:
fill-box`, the 2.8% window, amplitude folded into the closed pose. Slow-motion
   toggle in the demo.
5. ~~Breathe + bob (§4.2, §4.3).~~ **Built, unreviewed.** Both on the phases
   already emitted, both scaled by `--mo-rate`.
   **Nobody has watched any of it move yet.** `docs/motion-probe.html` asserts
   the mechanics in six legs — eyes close about their own centers, the body
   moves at full amplitude, and nothing moves at all at `--mo-amp: 0` — but a
   probe cannot tell you whether it _reads_ as a creature breathing. That
   judgement is the next step, at 5× in the demo, and preferably twice on
   different days.
6. ~~Hover reaction (§4.1).~~ **Built, unreviewed.** Transform transition on
   `.mo-root`, 220ms in / 160ms out, both scaled by `--mo-rate`. `mo-always`
   keeps it — a pinned blobatar is usually the large single one, which is exactly
   where a pointer response is wanted. Neutralized on touch, where it would
   latch at 1.04× on tap.

   **No probe covers this one.** `:hover` cannot be triggered from script, so
   the enter/exit asymmetry and the retarget behavior across a grid are
   hand-checks. Sweep the pointer fast across several rows: nothing should jump,
   restart, or lag behind the cursor.

7. ~~Idle saccades (§4.6).~~ **Built, unreviewed.** On `.mo-eyes`, four seeded
   fixations, jump-and-hold. Eyes are allowed to cross the body silhouette.
   Demo's focus modal now animates at `always`, so the layer can be judged at a
   size where it is actually visible.
8. ~~Wrap (§4.7).~~ **Built, unreviewed.** On `.mo-eye > *`, riding the saccade's
   clock: foreshortening, a leading-eye differential, and a per-eye opposite
   tilt on diagonals. Judge it at `always` on the focus modal — like §4.6 it is
   sub-pixel in a 40px grid. Watch specifically for the tilt reading as a head
   turn rather than as depth; if it does, the x·y term is too large before the
   foreshortening is.
9. ~~Gaze follow (§4.5).~~ **Built.** Ships as `blobatar/gaze` (the driver and
   the pure `step` beneath it) and `blobatar/gaze.css` (the geometry), not as
   `blobatar/motion` as this section originally named it. It targets the same
   group as saccades and they coexist by using different properties
   (`transform` vs `translate`).

   The open question in this line answered itself: a pointer-driven gaze and an
   idle glance do fight for meaning, and the resolution is not suppressing
   saccades while the pointer is *over* the blobatar but standing the rove down
   whenever the gaze is driving at all. That is `--mo-track-hold`, a cross-fade
   rather than a switch, and it zeroes the rove's seeds rather than pausing its
   loops so there is nothing stale to restart from.

   Two things the spec above is now wrong about. §4.5 specifies a spring
   (`stiffness: 120, damping: 14`); what shipped is an exponential filter with a
   saccade branch, because eyes following a moving target run *smooth pursuit*,
   which is continuous by construction, and a spring on a target that teleports
   overshoots rather than jumping. And the layer is measured by check J in
   `scripts/probe/entry.tsx`, which needs a browser that reports a fine pointer:
   Chrome is launched with Blink's pointer settings for it, and Firefox skips.

**Where steps 1–3 landed on size**, against the pre-motion baseline:

| Entry        | Before | After | Δ       |
| ------------ | ------ | ----- | ------- |
| `blob only`  | 3382   | 3449  | **+67** |
| `character`  | 3320   | 3330  | +10     |
| `both`       | 4474   | 4557  | +83     |
| `uri`        | 4569   | 4652  | +83     |
| `react`      | 4745   | 5239  | +494    |
| `motion.css` | —      | 230   | —       |

Static markup is byte-identical across 4000 renders (8 option sets × 500 seeds),
so that criterion held exactly. The **byte count did not** — "unchanged" in §10
was optimistic. The +67 B on `blob only` is the `mo` parameter threaded through
`blob.render`, which cannot be tree-shaken because it is a runtime branch inside
a function every consumer calls. Getting it to literally zero means a second
renderer module and a duplicated `render()`, which costs more in maintenance
than 67 B is worth — but it is a real deviation from the spec, not a rounding
error, and the number is here rather than quietly absorbed.

The `react` entry pays +494 B because it now carries both rendering modes. That
one is the feature, not overhead.

Two things kept the static path cheap and are worth not undoing:

- `makeParts` takes a **motion factory as an argument** instead of importing
  `src/animate.ts`. A direct import puts the motion module in every bundle,
  animating or not (+189 B measured).
- `_parts` builds its style table **per call** rather than hoisting it to module
  scope like `BLOBATARS`. A hoisted table is a top-level function call, which
  bundlers cannot prove is side-effect-free, so it survives tree-shaking and
  charges every static consumer (+145 B measured).

Add a **slow-motion toggle to the demo** in step 2 — a class that multiplies
every duration by 5. Timing problems in ambient motion are close to invisible at
full speed, and this is the kind of animation where reviewing it fresh the next
day genuinely changes what you ship.
