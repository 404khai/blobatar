# Motion spec

Status: **planned, not implemented.** Written for a future session to execute.

Adds an optional idle animation to the `blob` variant: a soft breathe, a bob, a
blink, and an optional gaze-follow. Off by default, hover-triggered when on.

---

## 1. The blocker to resolve first

`src/react.tsx` renders an `<img>` with a data URI. **This cannot be animated on
hover.** Content inside an SVG loaded through `<img>` is a non-interactive,
isolated document: `:hover` never fires inside it, and host-page CSS cannot
reach the shapes.

(CSS animations *declared inside* the SVG do run in an `<img>` — so an
always-on loop would technically work there. Hover would not. Since hover is the
default trigger, this does not rescue the `<img>` path.)

So an animated avatar **must render inline SVG**, and the adapter has to switch
rendering mode based on the prop:

| `animate` | Rendering | DOM nodes per avatar |
| --------- | --------- | -------------------- |
| `false` (default) | `<img src={dataUri}>` | 1 |
| `"hover"` / `"always"` | inline `<svg>` | ~10–16 |

The `<img>` path stays the default precisely because a list of 400 avatars is
the case it was chosen for. Animation is opt-in, and opting in costs DOM. Say
this in the README rather than hiding it.

---

## 2. Why hover, not always — and why that is not just taste

Emil's frequency table puts hover effects at "tens of times a day → remove or
drastically reduce." An avatar grid that breathes continuously is ambient motion
with no purpose, seen constantly. Hover-gating is the correct call on the
framework's own terms, not a compromise.

It also happens to be the performance answer. 400 continuously animating SVGs
means 400 composited layers ticking forever; hover means **one at a time**. The
aesthetic argument and the technical argument point the same way, which is
usually a sign the decision is right.

`animate="always"` exists as an escape hatch for the single-avatar case — a
profile header, an onboarding screen, a marketing page — where the frequency
argument does not apply.

**On the affordance question:** whether an avatar is clickable depends entirely
on the use case, so the library takes no position. `animate` is not documented
as "for interactive avatars only" and nothing warns about it. It is the
consumer's call, and they are the only one who knows.

---

## 3. The loop model — read this before §4

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
.mo-root:hover { --mo-amp: 1; }

.mo-breathe {
  /* Runs continuously. See "Why this runs rather than pauses" below — this
     single declaration is the whole decision, and it is not free. */
  animation: mo-breathe 2800ms ease-in-out infinite alternate;
  animation-delay: var(--mo-phase);
}

@keyframes mo-breathe {
  to {
    transform:
      scaleX(calc(1 + 0.022 * var(--mo-amp)))
      scaleY(calc(1 - 0.018 * var(--mo-amp)));
  }
}
```

The keyframes never restart, so the loop is always phase-continuous. At
`--mo-amp: 0` every keyframe resolves to the identity transform, so an unhovered
avatar is oscillating between two poses that are the same pose. Hover eases the
amplitude up; hover-out eases it back down. Nothing starts, nothing stops.

`animate="always"` is the same machinery with `--mo-amp: 1` pinned, ignoring
hover entirely.

### Why this runs rather than pauses — resolved, with measurements

The original design added `animation-play-state: paused` and only ran the
animation on hover, on the theory that idle avatars should cost nothing. That
depended on an unknown: does a *paused* animation re-resolve its transform when
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

The bill: every idle avatar now has a live animation rather than a paused one.
At `--mo-amp: 0` the transform is identity and the keyframes are static, so this
should stay on the compositor and stay cheap — but "should" is the word that
just cost us a redesign, so §10 carries a measurement task rather than an
assumption.

**If the measurement comes back bad**, the remaining fallback is to drop the
animation class on `animationiteration` after hover-out, so the loop always ends
on a cycle boundary at the neutral pose and idle avatars carry no animation at
all. Costs a JS listener per animated avatar, which is why it is not the default.

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
50% 50%` means the viewport center (50, 50). That is *close to* but not exactly
the body center, which `layout()` jitters by ±1.5 units. The difference is
invisible at these amplitudes, so keep the default box on the motion groups —
but write the translations in user units (`translateY(-1.5)`) rather than
percentages, so nobody later has to rediscover which box they resolved against.

The eyes are the exception: blink needs `transform-box: fill-box` (§4.4), and
that flips percentage resolution on those elements to the eye's own bounding
box. Gaze (§4.5) is specified in user units for the same reason.

### 4.1 Hover reaction — a transition, not a keyframe

The element the pointer arrives at should respond immediately.

```
scale: 1 → 1.04
translateY: 0 → -1.5    (user units, see above)
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
translateY: 0 ↔ -1.1  (user units)
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
interval:   3.5s–6.5s, seeded per avatar
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
  0%, 97.2%, 100% { /* open */ }
  98.6%           { /* closed */ }
}
```

The consequence: the blink's real duration is 2.8% of the interval, so it ranges
from ~95ms at a 3.5s period to ~180ms at 6.5s. That is a drift, not a bug — a
slower blinker reading as slightly sleepier is a feature, and 140ms was a
midpoint rather than a threshold. Accept it. The alternative — three or four
pre-authored keyframe sets selected by class — buys precision nobody can see and
triples the CSS.

Do not omit `--mo-blink-phase`. Without it every avatar's blink window sits at
the same offset in its own cycle, and while the periods differ, a fresh grid
still opens with a visible synchronized flutter before they drift apart.

**Critical:** each eye must scale about *its own* center. Applied to a shared
group, the eyes slide toward the group center instead of closing. Requires
`transform-box: fill-box; transform-origin: center` on each eye path —
verify browser support during implementation.

Blink is discrete, so amplitude gating works differently from the continuous
layers: fold `--mo-amp` into the closed scaleY so that a blink frozen by
hover-out re-opens as the amplitude eases to 0, rather than leaving the avatar
with its eyes shut. Roughly a 3% chance per hover-out otherwise — rare enough to
miss in testing, common enough to ship.

### 4.5 Gaze follow — optional, separate entry point

Eyes translate toward the pointer, capped at ~1.2 user units, spring-driven.

```
{ stiffness: 120, damping: 14 }   // or Apple form: { duration: 0.5, bounce: 0.15 }
```

Binding position directly to the pointer feels mechanical; a spring gives it
momentum. This is the one layer that needs JavaScript, so it ships as
`morphatar/motion` rather than being folded into the CSS.

Ship it last. The first four layers are pure CSS and carry most of the effect.

---

## 5. Seeded phase offsets — do not skip this

A grid where every avatar breathes in unison does not read as a crowd of
creatures. It reads as a heartbeat, or a drill team. It is the single most
likely way for this feature to look worse than no animation at all.

Fix: derive the phase from the seed and emit it as a CSS custom property.

```ts
// Negated at the source. Emitting the positive value is the one mistake this
// section exists to prevent, so do not leave the sign to the caller.
const phase = -t.num("motion.phase", 0, 2800);        // ms
const bob   = -t.num("motion.bob", 0, 3400);          // ms
const blink = t.num("motion.blink", 3500, 6500);      // period
const bph   = -t.num("motion.blinkPhase", 0, blink);  // ms
```

```html
<svg style="--mo-phase:-1740ms; --mo-blink:5.2s; --mo-blink-phase:-3100ms">
```

```css
.mo-breathe { animation-delay: var(--mo-phase); }
```

Negative delays start the animation mid-cycle immediately. A **positive** delay
postpones the start instead — and because the animation sits `paused` until
hover (§3), the delay clock does not run either, so a positive value buys up to
2.8 seconds of a hovered avatar doing nothing at all. Same keystroke, opposite
behavior, and it only shows up on first hover.

Breathe and bob need independent phases. Sharing one offset preserves the drift
between the two periods but locks every avatar into the same drift, which is the
grid-wide pulse this section is about, one level up.

**This costs nothing in compatibility.** Trait keys are string-addressed, so
adding `motion.phase` and `motion.blink` cannot perturb any existing avatar —
which is exactly the property the keyed-stream design was built for. Confirm
with the existing `trait independence` test.

---

## 6. Delivery: one stylesheet, not inline `<style>`

Inlining a `<style>` block per SVG is simpler DX but duplicates the same
keyframes N times — roughly 80KB of redundant CSS across a 400-avatar grid.

Ship `morphatar/motion.css` instead. The consumer imports it once; each SVG
carries only class names and two custom properties.

```ts
import "morphatar/motion.css";
```

Document the import as required. A silently non-animating avatar because someone
missed a CSS import is a bad first experience — consider a dev-only warning if
the stylesheet is absent.

### 6.1 `package.json` changes — the import does not survive without these

`"sideEffects": false` is currently set. That is a standing promise to bundlers
that no module in this package does anything but export values, which licenses
webpack and Rollup to **delete `import "morphatar/motion.css"` outright**. The
result is the silently-non-animating avatar above, except it happens to everyone
who ships through a bundler rather than to the one person who forgot a line.

```jsonc
{
  "sideEffects": ["*.css"],           // was: false
  "exports": {
    // …existing entries…
    "./motion": "./src/motion.ts",    // gaze follow (§4.5)
    "./motion.css": "./src/motion.css"
  }
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
<g class="mo-root">          <!-- hover reaction: scale + lift -->
  <g class="mo-breathe">     <!-- idle loop: squash/stretch -->
    <g class="mo-bob">       <!-- idle loop: vertical drift -->
      <g fill="…">…body + petals…</g>
      <g fill="…">
        <path class="mo-eye"/>   <!-- own transform-origin, for blink -->
        <path class="mo-eye"/>
      </g>
    </g>
  </g>
</g>
```

Classes are emitted **only** when `animate` is set, so the static path keeps its
current byte count exactly.

The wrapper belongs inside `style.render()`, not in `makeAvatar`. The backdrop
`<path>` is pushed separately in `makeAvatar` (`src/render.ts`) before
`style.render()` runs, and wrapping at that level would breathe the plate along
with the body. `blob` defaults to no backdrop, so this is invisible until
someone passes `background: "circle"` — which is exactly the kind of thing that
ships.

### 7.1 The React adapter

`AvatarProps extends ImgHTMLAttributes<HTMLImageElement>`. The inline path needs
`SVGProps<SVGSVGElement>`, so the public prop type becomes a union discriminated
on `animate` — a consumer passing `onLoad` should stop type-checking when they
turn animation on, because it stops firing.

```ts
type AvatarProps =
  | ({ animate?: false } & AvatarOptions & Omit<ImgHTMLAttributes<…>, "src">)
  | ({ animate: "hover" | "always" } & AvatarOptions & SVGProps<SVGSVGElement>);
```

`avatar()` returns markup as a string, so the inline branch renders the body
through `dangerouslySetInnerHTML` on an `<svg>` the adapter writes itself,
carrying `viewBox`, the seeded custom properties as a `style` object, and the
motion classes. That means `render()` needs to be reachable without the
surrounding `<svg>` — either a second export or a documented split of the string
— rather than the adapter regex-stripping the outer tag.

This is the bulk of the implementation work and none of it is CSS. Budget for it
accordingly.

---

## 8. Considered and rejected

**Animating the blob path data.** Morphing `radii` frame by frame would give a
genuinely wobbly body, and the Catmull-Rom generator makes it easy. Rejected:
path interpolation runs on the main thread every frame, which throws away the
main performance property of the CSS approach — animations that stay smooth
while the page is busy loading. Non-uniform scale gets ~80% of the read for 0%
of the main-thread cost.

**Rotating the sun's petal ring.** Tempting and cheap. Rejected for now: it
draws attention to one shape out of six, breaking the sense that all avatars
belong to the same family. Revisit as a deliberate per-shape motion vocabulary
if that is ever wanted.

**Bounce on hover-in.** Keep bounce ≤ 0.2 if used at all. An avatar grid is not
a playful drag interaction, and 400 bouncy elements is a toy, not a product.

---

## 9. Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .mo-root, .mo-breathe, .mo-bob, .mo-eye {
    animation: none;
    transition: none;
    transform: none;
  }
}

/* Touch devices fire hover on tap and hold it until the next tap elsewhere —
   a tapped avatar would sit there breathing. Neutralize, do not just comment. */
@media not ((hover: hover) and (pointer: fine)) {
  .mo-root:hover { --mo-amp: 0; }   /* defeat the hover rule, keep amplitude at rest */
}
```

Amplitude is the only gate now (§3), so neutralizing hover means overriding
`--mo-amp` and nothing else — do not reach for `animation-play-state` here, as
an earlier draft of this spec did. The animations keep running at zero
amplitude exactly as they do for any unhovered avatar on desktop.

`animate="always"` deliberately survives this block — it is not hover-triggered,
so the tap-latching problem does not apply to it. Scope the overrides to the
hover selectors only, and check this on a real touch device rather than in
devtools emulation, which reports `hover: hover` more often than not.

Reduced motion here means **fully static**. Emil's "gentler, not zero" guidance
applies to motion that aids comprehension; this motion is purely decorative, so
removing it costs the user nothing.

---

## 10. Budget and acceptance

| Entry | Budget (gz) |
| ----- | ----------- |
| `morphatar/motion.css` | 700 B |
| `morphatar/motion` (gaze JS) | 900 B |
| Static output byte count | **unchanged** |
| `blob only` JS | **unchanged** |

Only the first two are `scripts/size.ts` entries, and one of them needs a new
code path: every existing entry builds a synthetic TS consumer through
`Bun.build` and gzips the output, which is not how you measure a stylesheet.
Either add a `kind: "css"` branch that gzips the file directly, or let
`Bun.build` bundle a `.css` entrypoint and measure that — the latter keeps one
pipeline and also catches a syntax error in the CSS.

The bottom two rows are not budgets at all. "Static output byte count unchanged"
is a snapshot assertion in `test/avatar.test.ts`, and "`blob only` JS unchanged"
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
- [ ] **Measure idle cost and write the number here.** 400 avatars, nothing
      hovered, animations running at zero amplitude. Record CPU and whether the
      transforms stayed off the main thread (DevTools → Rendering → Frame
      Rendering Stats / Layers). This replaces the old "0% CPU" criterion, which
      the §3 decision made unachievable. If it lands above ~3% on a mid laptop,
      take the `animationiteration` fallback in §3.
- [ ] Same measurement with one avatar hovered — the 400ms amplitude ramp forces
      keyframe re-substitution and is the one moment the main thread is involved.
- [ ] `motion.css` survives a production bundle — build a webpack or Vite
      fixture that imports it and grep the output for `mo-breathe`. The
      `sideEffects` change in §6.1 is untestable from inside this repo.
- [ ] Blink phases are offset, not just periods — a fresh grid does not open
      with a synchronized flutter.
- [ ] Tapping an avatar on a real touch device leaves it static.

---

## 11. Build order

0. ~~Verify the loop model in a scratch file.~~ **Done.** Chrome and Firefox
   both re-resolve a paused effect, but Firefox will not interpolate one, so the
   loop runs continuously instead of pausing on hover-out. See §3. Re-run
   `amp-probe.html` on Safari before shipping; it is the one engine with no
   result yet, and it has historically been the weakest of the three at
   `@property`.
1. **Packaging first, before any motion at all** (§6.1): `sideEffects`,
   `exports`, `files`, and an empty `motion.css` that the demo imports. Ten
   minutes, and it means every step below is testing the real delivery path
   rather than a stylesheet that happens to be in scope.
2. **Blink alone**, hover-triggered. Highest ratio of aliveness to effort, and
   it settles both the per-eye `transform-origin` question and the interval
   mechanism in §4.4.
3. The inline-SVG adapter branch (§7.1) — unavoidable to see step 2 at all, so
   do not let it arrive as a surprise between steps.
4. Breathe + bob, with seeded phase and amplitude gating.
5. Hover reaction transition.
6. Gaze follow (`morphatar/motion`, JS).

Add a **slow-motion toggle to the demo** in step 2 — a class that multiplies
every duration by 5. Timing problems in ambient motion are close to invisible at
full speed, and this is the kind of animation where reviewing it fresh the next
day genuinely changes what you ship.
