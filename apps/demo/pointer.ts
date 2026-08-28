/**
 * Pointer gaze, as an instrument. The layer itself shipped: the pursuit, the
 * near field, the saccade branch and the write threshold are `blobatar/gaze`,
 * imported below, and `blobatar/gaze.css` carries the geometry. What is left
 * here is the harness around it, which is the part that was always a question
 * rather than an answer.
 *
 * Two questions, specifically, and neither can be settled by looking at one
 * blobatar, which is why this lands on the tuning grid at 400 rather than in a
 * story at 1: whether a *field* of these reads as delightful or as surveilled,
 * and what it costs at wall density. The gate, the falloff radius, the
 * off-screen culling and the cost readout all exist to answer those, and none
 * of them is in the library.
 *
 * ## Written to the eyes, not to the root
 *
 * The channels are set on `.mo-eyes`. Setting them once on `.mo-root` and
 * letting them inherit reads better and is an invalidation of the blobatar's
 * whole twelve-element subtree every frame for a value three elements read. The
 * style recalculation that provokes is most of what the layer costs; the JS
 * never was, at 0.2ms against frames of 40ms and up. That measurement is why
 * the library's driver resolves `.mo-eyes` too.
 *
 * ## The driver writes custom properties and nothing else
 *
 * No classes, no attributes, and that is a finding rather than a style. The
 * first version marked each blobatar with a class so the stylesheet had a hook,
 * and React silently ate it: `.mo-root`'s `className` is composed by the adapter
 * from `animate` and the expression, so it is rewritten wholesale whenever
 * either changes, taking any imperatively added class with it. The failure is
 * the worst kind. The driver keeps running, the readout keeps reporting a live
 * field, and every blobatar stops moving, because the only thing that broke is
 * the stylesheet's hook.
 *
 * Moving the class to the `<svg>` fixed it here and would break on the landing
 * page, where the hero passes its own `className` through and React owns that
 * attribute too. So the rule is the one the failure teaches: **a driver that
 * writes a class into a framework's DOM is racing the framework for that
 * attribute, and it loses quietly rather than loudly.** Custom properties are
 * not contested — React never writes `--mo-track-*` — so the driver writes only
 * those, and every host decides in its own stylesheet where the layer applies.
 * Here that is `[data-gaze]` on the grid, which React owns and sets.
 *
 * ## The seam already exists
 *
 * `motion.css` reserves `.mo-eyes`'s `transform` for "the pointer-driven gaze
 * layer (§4.5)" in two places, and leaves the saccade on `translate` precisely
 * so the two never fight over one property. So this adds a term to a
 * composition that was built expecting it, rather than restating anybody's
 * keyframes. The reservation also carries a warning: a scale or a rotation on
 * that group would need an explicit `transform-origin`, because the group's box
 * is both blinking eyes and moves as they close. This is a translate, which is
 * immune, and it should stay one.
 *
 * ## Why this is smoothed when the saccade is not
 *
 * `motion.css` is emphatic that easing the saccade gives floating eyeballs, and
 * it is right: a saccade is ballistic, so anything but a snap between holds
 * reads wrong. This is not a saccade. Eyes following a moving target run *smooth
 * pursuit*, a different oculomotor system that is continuous by construction, so
 * the easing here is not a softened saccade, it is the correct shape for the
 * thing being modelled. That only holds while the target moves at pursuit
 * speeds. A pointer that jumps across the screen is not something an eye
 * pursues, it is something an eye saccades to, which is what `snap` below is.
 *
 * ## The two questions this is built to answer
 *
 * Both are gating, and neither can be settled by looking at one blobatar, which
 * is why it lands on the tuning grid at 400 rather than in a story at 1.
 *
 * 1. **Does a field of these read as delightful or as surveilled?** `animate.ts`
 *    already rules that "ambient motion seen constantly is motion worth
 *    removing", and gaze at `all` is ambient motion by definition: every
 *    blobatar on the page moving, all the time, because the pointer moved. The
 *    `near` gate is the alternative, where attention falls off with distance and
 *    the page has a small live neighbourhood around the cursor instead.
 * 2. **What does it cost at wall density?** Reported per frame rather than
 *    asserted, because `packages/harness/scripts/size.ts` catching 3.7 kB of
 *    unimported expressions is the standing reminder that the number is not the
 *    one you assume.
 *
 * ## What it cost, and where that went
 *
 * n=200, `animate="hover"`, 64px cells, sweeping the pointer across the grid.
 * Headless Chrome on software raster, so read the shape:
 *
 *   as first built                          11 fps
 *   + unhovered blobatars paused            31 fps
 *   + channels written direct, not inherited 40 fps  (see `Tracked.targets`)
 *   ...with `reach` at 80px instead of 260   43 fps
 *
 * Note what is *not* in that list. The driver's own JavaScript never left 0.2ms
 * at any point, against frames of 90ms at the start, so nothing here was won by
 * making this file's arithmetic faster and nothing would have been. Every step
 * is about how much work the writes hand to the style engine afterwards, which
 * is why `TrackStats.writes` exists and why `TrackStats.ms` carries a warning.
 *
 * The last line is the one worth keeping in mind while tuning: **`reach` is a
 * performance dial as much as a taste one**, because it decides how many
 * blobatars are legitimately in motion. Measured at n=200, peak writes per frame
 * against reach: 600px/1020, 260px/370, 140px/90, 80px/60. The readout shows
 * that number live, so the cost of a wider neighbourhood is visible while you
 * are choosing one rather than discovered afterwards.
 */

import {
  DEADZONE,
  HOLD_EPS,
  SNAP,
  pursuit,
  smoothstep,
  step,
  threshold,
} from "blobatar/gaze";

export type Gate = "near" | "all";

export interface TrackOptions {
  /**
   * `all`: every tracked blobatar looks at the pointer, at full excursion,
   * wherever it is. `near`: excursion falls off with distance and reaches zero
   * at `reach`.
   */
  gate: Gate;
  /** Falloff radius in CSS pixels. Ignored under `all`. */
  reach: number;
  /**
   * Full-amplitude eye excursion in viewBox units.
   *
   * For scale: the idle saccade's widest stop is `1px * --mo-look-x`, a median
   * 1.4 units, and `candidates.ts` puts a deliberate glance at roughly three
   * times the idle one. So the interesting range is about 1.5 to 4, and the
   * ceiling is set by the eyes crossing the silhouette. Nothing clips them, and
   * `motion.css` is explicit that this is deliberate: "an eye riding past the
   * edge reads as a face turning on a round head rather than as a mistake".
   */
  travel: number;
  /**
   * Pursuit time constant in ms: how long the eyes take to cover ~63% of the
   * distance to a new target. 0 removes the smoothing entirely, which is worth
   * looking at once to see the floating-eyeball argument from the other side.
   */
  settle: number;
  /**
   * Target movement in one frame, as a fraction of the excursion, past which
   * the eyes stop pursuing and jump. Above this the target is not something an
   * eye tracks, it is one that has been replaced.
   *
   * In units of the normalised direction, which is `blobatar/gaze`'s space and
   * no longer this file's. It used to be CSS pixels, compared after scaling by
   * `travel`, which meant retuning the excursion silently retuned the saccade
   * threshold with it and the same named constant meant different things here
   * and on the landing page.
   */
  snap: number;
  /**
   * A fixed point in client coordinates to aim at instead of the pointer, or
   * `null` to follow it.
   *
   * The pointer is one *source* of a target, not the target itself, and this is
   * the seam that says so. Everything downstream, the falloff, the pursuit, the
   * near-field ease, the stand-down, is arithmetic on a point and does not care
   * where the point came from, so aiming a field at something that is not the
   * cursor costs one substitution and no new machinery.
   *
   * Client coordinates rather than page ones, because that is the space the
   * cached centres are already in: `getBoundingClientRect` is viewport-relative,
   * so a caller pinning a spot in the *document* has to re-aim on scroll, the
   * same way the driver re-measures on it. That is the caller's to decide and
   * not something to guess at here. Pinning to the viewport and pinning to the
   * page are both things somebody wants, and only one of them can be the
   * default.
   *
   * It also settles what the pointer leaving the window means while this is set:
   * nothing. `onLeave` parks the *pointer* far outside, and a driver reading a
   * fixed point never looks at it, which is the right answer. A target that is
   * present because the caller says so does not stop being present because the
   * cursor went to another window.
   */
  at: { x: number; y: number } | null;
  /**
   * Whether to also write the unsigned magnitudes the sphere cues read.
   *
   * A flag rather than something always on, because it is two more style writes
   * per blobatar per frame and the readout is supposed to answer what this
   * costs. Off, the layer is a pure translate and the magnitudes are never
   * touched, so `pointer.css`'s wrap rule resolves to the identity.
   */
  wrap: boolean;
}

/** What the driver reports back, for the cost half of the question. */
export interface TrackStats {
  /** Blobatars currently on screen and being written to. */
  live: number;
  /** Blobatars registered, on screen or not. */
  total: number;
  /**
   * Property writes issued on the last frame, summed over every blobatar.
   *
   * The number the frame interval is a consequence of, and the one worth
   * watching while tuning: three elements per blobatar and two or four
   * properties each, so a single settling blobatar is up to ten. If this reads
   * in the hundreds while a handful of blobatars are anywhere near the pointer,
   * the threshold is wrong rather than the layer.
   */
  writes: number;
  /**
   * Smoothed cost of the driver's own update pass, in ms.
   *
   * **This is not what the page costs, and reading it as though it were is a
   * mistake this harness has already made once.** It times the callback and
   * nothing else. Everything the writes then *provoke* — style recalculation on
   * every subtree whose registered custom properties changed, and the paint and
   * composite that follow — happens after this returns, and is most of the bill.
   */
  ms: number;
  /**
   * Smoothed interval between consecutive frames, in ms. The honest number.
   *
   * The browser cannot schedule the next frame until it has finished the work
   * the last one caused, so this is the one measurement that contains the style
   * recalc `ms` misses. When the two disagree by an order of magnitude, the
   * difference is exactly the cost of writing to that many elements, and that is
   * the reading worth trusting.
   */
  frame: number;
  /** Whether the rAF loop is currently running, or parked at rest. */
  running: boolean;
}

interface Tracked {
  /** The `.mo-root` group. Identity only now: nothing is written here. */
  el: SVGElement;
  /**
   * The three elements that actually read the gaze channels: `.mo-eyes`, which
   * carries the translate, and the two `.mo-eye` groups, which carry the sphere.
   *
   * **Written to directly, because inheritance is not free.** The channels used
   * to be registered `inherits: true` and set once on `.mo-root`, which is two
   * style writes per blobatar instead of ten and reads much better. It is also
   * an invalidation of that blobatar's entire twelve-element subtree, every
   * frame, for a value three of those elements read — and the style recalc that
   * provokes is most of what the layer costs. The JS was never the bill: it
   * measures 0.2ms against frames of 40ms and up.
   *
   * Resolved once per scan rather than per frame. `querySelector` inside the
   * loop would put a DOM traversal per blobatar per frame back in exactly the
   * place this is trying to take work out of.
   */
  targets: SVGElement[];
  eyes: SVGElement | null;
  /** The `<svg>`, whose box is the whole cell. Measured, never written to. */
  box: Element;
  cx: number;
  cy: number;
  /** Current smoothed excursion, in viewBox units divided by `travel`. */
  x: number;
  y: number;
  /** Rendered width in CSS pixels, for turning a threshold into something seen. */
  w: number;
  /**
   * How far the idle saccade has stood down for the gaze, 0 to 1.
   *
   * Follows the gate's falloff, so it is a constant 1 under `all` and the
   * cross-fade under `near`. Smoothed on the same time constant as the
   * excursion, because a blobatar handing its eyes over should do it at the
   * speed it takes them, not instantly.
   */
  h: number;
  /** Last value written, so a settled blobatar costs no style writes. */
  wx: number;
  wy: number;
  wh: number;
  live: boolean;
}

/*
 * `VISIBLE_PX`, `EPS_MIN`, `EPS_MAX` and the derivation that turns them into a
 * per-blobatar threshold are `blobatar/gaze`'s `threshold` now, and the whole
 * argument for them is in its comments. What is worth keeping here is the
 * measurement that produced them, because this is where it was made: the flat
 * 0.002 on the unit vector they replaced was most of what this layer cost at
 * n=200, a forty-frame write tail per blobatar converging on movement no
 * display could resolve.
 */

/*
 * The falloff uses the library's `smoothstep`, for the reason it was always
 * this shape: a linear ramp puts a visible discontinuity at `reach`, where the
 * blobatar at the edge of the neighbourhood is still turning at a constant rate
 * when its amplitude hits zero, so it stops mid-movement. Flat at both ends,
 * blobatars join and leave the neighbourhood without a corner.
 */

/*
 * The near field is `DEADZONE`, imported. It used to be filed here as the one
 * thing a single large blobatar needs that a grid of small ones does not, and
 * this harness is what disproved that: the same twitch appears at any cell size
 * the pointer can get inside, which is reached by about 100px and well past at
 * 164. That finding is why the constant is in the library rather than in either
 * of the two files that used to keep their own.
 */

/*
 * `HOLD_EPS` is imported. It is coarse on purpose: this scales the idle rove's
 * seeds, and a 1% change in the amplitude of a glance nobody is watching for is
 * not something anyone can see. It is also the only channel written to
 * `.mo-root`, so each write invalidates that blobatar's whole subtree, which is
 * the cost `Tracked.targets` exists to avoid.
 */

/**
 * Start tracking every `.mo-root` under `root`.
 *
 * `opts` is read as a function on every frame rather than captured, so the
 * sliders retune a running field instead of tearing it down and rebuilding it.
 * Retuning while watching is the entire point of the harness.
 */
export interface Tracker {
  /**
   * Re-read the DOM. The caller calls this whenever the grid's contents change,
   * because a React render is the only thing that knows they did and a
   * MutationObserver watching a 400-cell grid would fire per cell.
   */
  rescan: () => void;
  /**
   * Restart the loop after a change the driver cannot see.
   *
   * `opts()` is read per frame, which is what lets the sliders retune a running
   * field. But a *parked* field runs no frames, so a settled grid never notices
   * that `at` moved. Every other option is one the pointer is already moving
   * for; this one is not, so the caller that changes it says so.
   */
  wake: () => void;
  stop: () => void;
}

export function track(
  root: HTMLElement,
  opts: () => TrackOptions,
  report?: (s: TrackStats) => void,
): Tracker {
  /*
   * Both guards are the ones `motion.css` already applies to the idle layer, and
   * they are guards rather than degradations because there is nothing to
   * degrade to: gaze with no pointer is not a reduced gaze, it is nothing.
   *
   * `prefers-reduced-motion` is the stronger of the two. Continuous motion
   * chasing the cursor is close to the top of the list of things that setting
   * exists to turn off.
   */
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || still.matches) {
    return { rescan: () => {}, wake: () => {}, stop: () => {} };
  }

  let items: Tracked[] = [];
  let px = -1e6;
  let py = -1e6;
  let last = 0;
  let raf = 0;
  let ms = 0;
  let frameMs = 0;
  let dirty = false;

  /*
   * Culling, and the reason it is here rather than being an optimisation to add
   * later: the tuning grid pages 400 blobatars and the wall (ADR-0011) is
   * unbounded, so "how many are on screen" and "how many exist" are different
   * numbers by an order of magnitude, and only the first should cost anything
   * per frame.
   */
  const byBox = new Map<Element, Tracked>();
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const it = byBox.get(e.target);
        if (it) it.live = e.isIntersecting;
      }
      wake();
    },
    { rootMargin: "10%" },
  );

  /*
   * Geometry, and the reason this is not left to `scroll` and `resize`: those
   * two catch the page moving under a stable layout, and the grid's layout is
   * not stable. The harness's `size` slider is the grid's `auto-fill` track
   * width, so changing it reflows every cell to a new size and a new column
   * without the window changing at all, and a driver holding centres measured
   * for the old layout keeps aiming at where the cells used to be. That failure
   * hides at a distance, where the direction to a centre 100px off is nearly the
   * direction to the real one, and only shows up with the pointer close, which
   * is the worst way for it to show up.
   *
   * The host is told to `rescan` on that, but relying on it means every host has
   * to enumerate every piece of its own state that happens to affect layout, and
   * the one it forgets fails silently. Observing the boxes the driver already
   * measures is the same signal taken from the DOM instead, so it cannot be
   * forgotten. It fires once per element on `observe` and then only on real
   * reflows, and it is coalesced into one `measure` per batch.
   */
  const resized = new ResizeObserver(() => {
    measure();
    wake();
  });

  const measure = () => {
    for (const it of items) {
      const r = it.box.getBoundingClientRect();
      it.cx = r.left + r.width / 2;
      it.cy = r.top + r.height / 2;
      it.w = r.width;
    }
  };

  const scan = () => {
    seen.disconnect();
    const prev = new Map(items.map((i) => [i.el, i]));
    items = [...root.querySelectorAll<SVGElement>(".mo-root")].map((el) => {
      const kept = prev.get(el);
      if (kept) return kept;
      const box = el.closest("svg") ?? el;
      const eyes = el.querySelector<SVGElement>(".mo-eyes");
      /*
       * One element, where this used to resolve three. `blobatar/gaze.css`
       * registers the channels `inherits: true`, so the two `.mo-eye` groups
       * read the sphere magnitudes off their parent instead of being written to
       * individually, and the invalidation is still scoped to the eyes rather
       * than to the blobatar's whole subtree, which is the measurement this
       * harness made and the library kept.
       */
      const targets = eyes ? [eyes] : [];
      return {
        el, box, eyes, targets,
        cx: 0, cy: 0, w: 0,
        x: 0, y: 0, h: 0,
        wx: 0, wy: 0, wh: 0,
        live: false,
      };
    });
    byBox.clear();
    resized.disconnect();
    for (const it of items) {
      byBox.set(it.box, it);
      seen.observe(it.box);
      resized.observe(it.box);
    }
    measure();
    wake();
  };

  const frame = (t: number) => {
    raf = 0;
    const t0 = performance.now();
    /*
     * Smoothed before the clamp, and from the raw delta: a frame the style
     * engine took 90ms to get back from is precisely the frame worth recording,
     * and clamping it first is how a stutter measures as smooth.
     */
    if (last) frameMs += (t - last - frameMs) * 0.1;
    const dt = last ? Math.min(t - last, 64) : 16;
    last = t;

    const { gate, reach, travel, settle, snap, wrap, at } = opts();
    /* The one place the pointer is privileged, and only as a default. */
    const ax = at ? at.x : px;
    const ay = at ? at.y : py;
    /*
     * Frame-rate independent exponential smoothing. A fixed per-frame lerp
     * factor would make the pursuit visibly faster on a 120Hz display than on a
     * 60Hz one, which is the bug where an animation "feels different on my
     * laptop" and nobody can say why.
     */
    const k = pursuit(dt, settle);

    let live = 0;
    let writes = 0;
    let moving = false;

    for (const it of items) {
      if (!it.live) continue;
      live++;

      const dx = ax - it.cx;
      const dy = ay - it.cy;
      const d = Math.hypot(dx, dy);

      /*
       * The gate's own falloff, kept separate from the near-field ease inside
       * `step` because the two answer different questions and only this one
       * decides whether the idle rove stands down. Under `all` it is 1
       * everywhere, which is what `all` means.
       *
       * It goes in as `gain`, which is the seam `blobatar/gaze` leaves for
       * exactly this: whether a blobatar is looking, as opposed to where. The
       * driver on the landing page has no gate and passes nothing.
       */
      const gain = gate === "all" ? 1 : smoothstep(Math.max(0, 1 - d / reach));

      /*
       * The pursuit, the near field and the saccade branch are the library's.
       * This file used to carry its own copy of all three and they have drifted
       * once already: the `snap` here was compared in CSS pixels while the
       * landing page compared the same named constant against the normalised
       * direction, so "1.6" meant two different things in two files that were
       * supposed to agree. It is the normalised form now, and there is one of
       * it.
       */
      const s = step({ x: it.x, y: it.y, dx, dy, radius: it.w / 2, k, snap, gain });
      const f = s.f;
      it.x = s.x;
      it.y = s.y;

      /*
       * The threshold, derived per blobatar from how big it actually is on
       * screen. Per blobatar rather than per grid because the grid does not have
       * one answer: the same field at 24px and at 200px wants thresholds an
       * order of magnitude apart.
       */
      const eps = threshold(it.w, travel);

      /*
       * Arrival, and it has to be decided against the target rather than
       * inferred from the write below. The write threshold measures distance
       * from the *last written value*, not from the target, so a blobatar
       * mid-pursuit is silent on every frame its increment lands under `eps`,
       * and one silent frame across the whole field parks the rAF loop, freezing
       * everyone where they happened to be. The residual that strands is up to
       * `eps / k`, which at a 90ms `settle` is around six times `eps`: not a
       * rounding error, a visibly wrong direction held until the pointer moves
       * again.
       */
      if (Math.abs(s.tx - it.x) <= eps && Math.abs(s.ty - it.y) <= eps) {
        it.x = s.tx;
        it.y = s.ty;
      } else {
        moving = true;
      }

      /*
       * The hand-over, on the same exponential and the same arrival rule.
       *
       * `gain` rather than the combined amplitude: the near-field ease is about
       * the excursion having no direction to point in, not about the gaze
       * letting go, and feeding it in here would make a blobatar start roving
       * idly the moment the pointer landed on top of it. The rove coming *back*
       * under the cursor is a stranger thing to watch than the wild flick it
       * replaced.
       *
       * `s.f` and not `k`, so a blobatar whose eyes just saccaded hands its rove
       * over on the same frame rather than gliding through the jump.
       */
      it.h += (gain - it.h) * f;
      if (Math.abs(gain - it.h) <= HOLD_EPS) it.h = gain;
      else moving = true;

      if (Math.abs(it.h - it.wh) > HOLD_EPS) {
        it.wh = it.h;
        /* The only write to `.mo-root`, and the only one that is not on the
           three elements `targets` resolved. See `HOLD_EPS`. */
        it.el.style.setProperty("--mo-track-hold", it.h.toFixed(3));
        writes += 1;
      }

      if (Math.abs(it.x - it.wx) > eps || Math.abs(it.y - it.wy) > eps) {
        it.wx = it.x;
        it.wy = it.y;
        const sx = it.x.toFixed(3);
        const sy = it.y.toFixed(3);
        /*
         * The magnitudes, drawn separately and unsigned — the same split
         * `motionVars` already makes for `--mo-look-m*`, and here for the same
         * reason it gives: how far a feature foreshortens depends on how far the
         * face turned, not on which way it turned. Computed here rather than
         * with CSS `abs()` so the stylesheet stays the arithmetic the library
         * would recognise.
         */
        const mx = wrap ? Math.abs(it.x).toFixed(3) : "";
        const my = wrap ? Math.abs(it.y).toFixed(3) : "";
        for (const t of it.targets) {
          t.style.setProperty("--mo-track-x", sx);
          t.style.setProperty("--mo-track-y", sy);
          writes += 2;
          /* Written beside the direction rather than on the two `.mo-eye`
             groups that read them: they inherit. Two writes where this used to
             cost four. */
          if (wrap) {
            t.style.setProperty("--mo-track-mx", mx);
            t.style.setProperty("--mo-track-my", my);
            writes += 2;
          }
        }
        moving = true;
      }
    }

    /*
     * Exponentially smoothed, because a single frame's number is noise and the
     * question is what this costs steadily.
     */
    ms += (performance.now() - t0 - ms) * 0.1;

    /*
     * Park when nothing is left to settle. This is the whole cost argument: a
     * still pointer over a settled field runs no rAF at all, so the idle cost of
     * having the feature on is zero rather than "cheap".
     */
    if (moving || dirty) {
      dirty = false;
      raf = requestAnimationFrame(frame);
    } else {
      last = 0;
    }
    report?.({ live, total: items.length, writes, ms, frame: frameMs, running: raf !== 0 });
  };

  const wake = () => {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    wake();
  };

  /*
   * The pointer leaving the window is a real state and not just an absent one:
   * the eyes should return to centre rather than hold their last glance at an
   * edge. Parking it far outside gives that for free under `near`, and under
   * `all` it means the whole field settles on one direction, which is the
   * honest answer for a gate that says "always look".
   */
  const onLeave = () => {
    px = -1e6;
    py = -1e6;
    wake();
  };

  /*
   * Scroll and resize invalidate every cached centre. Passive, coalesced through
   * the same rAF, and this is the reason centres are cached at all: 400
   * `getBoundingClientRect` calls per pointer move is a layout thrash, 400 per
   * scroll event is one too, but 400 on scroll only is a page that stays smooth
   * while the pointer sweeps, which is the common case by a wide margin.
   */
  const onGeom = () => {
    measure();
    wake();
  };

  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerleave", onLeave, { passive: true });
  addEventListener("scroll", onGeom, { passive: true, capture: true });
  addEventListener("resize", onGeom, { passive: true });
  scan();

  const stop = () => {
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerleave", onLeave);
    removeEventListener("scroll", onGeom, { capture: true });
    removeEventListener("resize", onGeom);
    seen.disconnect();
    resized.disconnect();
    if (raf) cancelAnimationFrame(raf);
    for (const it of items) {
      it.el.style.removeProperty("--mo-track-hold");
      for (const t of it.targets) {
        t.style.removeProperty("--mo-track-x");
        t.style.removeProperty("--mo-track-y");
        t.style.removeProperty("--mo-track-mx");
        t.style.removeProperty("--mo-track-my");
      }
    }
    items = [];
    byBox.clear();
  };

  return { rescan: scan, wake, stop };
}
