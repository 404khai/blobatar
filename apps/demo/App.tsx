import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  blobatar,
  traits,
  type Animate,
  type BlobatarOptions,
} from "blobatar";
import { layout } from "blobatar/blob";
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
  type Expression,
} from "blobatar/expression";
import { Blobatar } from "@blobatar/react";
import { CANDIDATES } from "./candidates";
import { track, type Gate, type TrackOptions, type TrackStats } from "./pointer";
/* Not a control, because it is not a taste question: below it the pointer is
   something an eye can follow, above it the target has teleported. Imported so
   the harness is judging the shipped threshold and not one of its own. */
import { SNAP } from "blobatar/gaze";
import { cull, type Cull } from "./offscreen";

/**
 * The tuning harness.
 *
 * The point is the grid, not the single blobatar. Numeric ranges can only be
 * judged in aggregate — you are looking for clusters, dead zones and outliers,
 * which are invisible when you inspect one seed at a time. The shape filter
 * exists because the rarer silhouettes would otherwise appear a handful of
 * times per page, which is too few to tune against.
 */

const COLS = 20;
const ROWS = 20;


/**
 * The sphere cues' coefficients at `sphere = 1`, against the *normalised* gaze
 * direction. See the second half of `pointer.css` for the derivation.
 *
 * These are `mo-wrap`'s own constants carried across at the saccade's median
 * excursion — 0.022·1.4, 0.030·1.1, 0.9·1.4·1.1 — so `sphere = 1` is "exactly as
 * much sphere as an idle glance has", whatever `travel` happens to be. That is
 * the honest starting point for the question, which is whether a deliberate look
 * three times the length of a glance wants three times the projection or the
 * same amount of it.
 */
const SPHERE_X = 0.031;
const SPHERE_Y = 0.033;
const SPHERE_TILT = 1.39;

/**
 * The differential as a fraction of the shared coefficient.
 *
 * Not a control. `motion.css` requires it under half the shared one at every
 * stop, because that is what guarantees the pair never scales past 1, and an eye
 * *growing* on a glance is the tell that breaks the illusion instantly. A slider
 * here would be a slider whose top half is a bug.
 */
const SPHERE_DIFF = 0.45;

/**
 * Blobatar 2's silhouettes, including `all` for an unfiltered grid.
 */
const SHAPES = [
  "all", "round", "organic", "boxy", "capsule", "nub",
  "cloud", "droplet", "hexagon", "sun", "triangle",
] as const;

/**
 * The package major's silhouette for a seed, without paying for a palette.
 */
const silhouetteOf = (seed: string) => layout(traits(seed)).shape;

/**
 * The candidate ballot, as a grid mode.
 *
 * It is a *third* rendering mode rather than a fourth entry in `PAIRS` because
 * the two modes answer opposite questions. A pair asks whether two poses are
 * confusable, so it renders through the string API deliberately — idle motion
 * running underneath is noise on exactly that comparison. The ballot asks which
 * of three *loops* reads best, so it does the reverse: it forces the animated
 * adapter on regardless of the `animate` control, because a still frame of these
 * three would only collect votes on eye position.
 */
const TRIO = "thinking: A|B|C";

/**
 * The `a|b` entries are not expressions — they are the comparisons the roster
 * hangs on, rendered as modes. See `.cell.pair` in index.css.
 *
 * There are two now because the second roster added a second at-risk pair.
 * `sad|mad` was the original: two poses that have to stay distinct at 44px with
 * no brows to separate them. `surprised|scared` is its counterpart at the other
 * end of `esy` — the only two poses that leave the capsule portrait, so they are
 * the ones that can converge.
 */
const EXPRESSIONS: Record<string, Expression | null> = {
  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  smug,
  unsure,
  scared,
  love,
  shy,
  sick,
  thinking,
  "sad|mad": null,
  "surprised|scared": null,
  "shy|sick": null,
  "sleepy|thinking": null,
  [TRIO]: null,
};
const PAIRS: Record<string, Expression[]> = {
  "sad|mad": [sad, mad],
  "surprised|scared": [surprised, scared],
  "shy|sick": [shy, sick],
  // The pair that has to stay apart at 44px: both are lidded and level, and
  // only one of them is staggered.
  "sleepy|thinking": [sleepy, thinking],
};

type Bg = "default" | "squircle" | "circle" | "square" | "none";

export function App() {
  const [prefix, setPrefix] = useState("user-");
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState<Bg>("default");
  const [shape, setShape] = useState("all");
  const [hue, setHue] = useState<number | "">("");
  const [focus, setFocus] = useState<string | null>(null);
  const [animate, setAnimate] = useState<Animate | "">("");
  const [slow, setSlow] = useState(false);
  const [expr, setExpr] = useState<keyof typeof EXPRESSIONS>("idle");
  const [gaze, setGaze] = useState<Gate | "">("");
  const [reach, setReach] = useState(260);
  const [travel, setTravel] = useState(5);
  const [settle, setSettle] = useState(90);
  const [wrap, setWrap] = useState(true);
  const [sphere, setSphere] = useState(1);
  const [tilt, setTilt] = useState(SPHERE_TILT);
  const [cost, setCost] = useState<TrackStats | null>(null);
  /*
   * Density, as two controls rather than one.
   *
   * They were `COLS × ROWS`, fixed at 400, which is fine for the grid's original
   * job — a static field, no frame loop, and the count is free. It is not fine
   * with `animate="always"` on, and the numbers are worth writing down because
   * they are not where anyone expected them (headless Chrome, software raster,
   * so read the shape rather than the absolute values):
   *
   *   n     gaze off   gaze near   gaze all
   *   50      60fps      56fps       53fps
   *   100     35fps      28fps       25fps
   *   200     15fps      13fps       10fps
   *   400      6fps       5fps        5fps
   *
   * **The cliff is the idle layers, not the gaze layer.** Four hundred animated
   * blobatars are already at 6fps with gaze switched off; turning it on costs
   * another 10-20%. Which is `animate.ts`'s own ruling arriving with a number
   * attached: `"hover"` animates one blobatar at a time and that file calls it
   * "both the aesthetic answer and the performance one". A field on `always` is
   * exactly the thing the library declines to do by default.
   *
   * Two controls rather than one, because they are two different costs. Count is
   * what the driver and the style engine pay per frame; size is what the
   * compositor pays, and it is also what decides whether a cue is legible at
   * all. The sphere reads differently at 40px and at 160px on an otherwise
   * identical field, and a single "density" dial would confound those two
   * questions every time it moved.
   */
  const [size, setSize] = useState(64);
  const [shown, setShown] = useState(200);
  const [culling, setCulling] = useState<Cull>("unhovered");

  const opts: BlobatarOptions = useMemo(
    () => ({
      background: bg === "default" ? undefined : bg === "none" ? false : bg,
      hue: hue === "" ? undefined : hue,
      expression: EXPRESSIONS[expr] ?? undefined,
    }),
    [bg, hue, expr],
  );

  const pair = PAIRS[expr];
  const trio = expr === TRIO ? CANDIDATES : null;

  // Paired cells are twice as wide, so half as many fit a row, and the ballot is
  // wider still and deliberately much coarser: five seeds is plenty when the
  // question is about a loop rather than a numeric range, and the cells have to
  // be large enough to actually watch. Both keep their own fixed columns.
  //
  // The plain grid does not, any more: `null` hands the column count to
  // `auto-fill` at the chosen cell size, so `size` changes how big the
  // blobatars are and `shown` changes how many there are, instead of one number
  // silently deciding both.
  const cols = trio ? 4 : pair ? COLS / 2 : null;
  const count = trio ? 8 : pair ? (COLS / 2) * ROWS : shown;

  // Filtering by shape means scanning forward past the seeds that do not match,
  // so a rare silhouette still fills a whole page.
  const seeds = useMemo(() => {
    const out: string[] = [];
    const wanted = shape !== "all" ? shape : null;
    for (
      let i = page * count;
      out.length < count && i < page * count + count * 200;
      i++
    ) {
      const seed = `${prefix}${i}`;
      if (!wanted || silhouetteOf(seed) === wanted) out.push(seed);
    }
    return out;
  }, [prefix, page, shape, count]);

  const stats = useMemo(() => {
    const sizes = seeds.map((s) => blobatar(s, opts).length);
    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      avg: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    };
  }, [seeds, opts]);

  /*
   * Gaze needs the inline-SVG branch, because that is the only one that emits
   * `.mo-root` at all — the string API renders a static blobatar with no motion
   * classes for the driver to find. It is *not* gated on `animate="always"`
   * though, and the `hover` combination is the more interesting of the two: a
   * field where nothing breathes until you arrive but everything watches you
   * cross it is precisely the "delightful or surveilled" question, asked with
   * every other layer held still.
   *
   * Off in ballot mode for the reason `pointer.css` gives: three loops being
   * compared against each other do not want a fourth running over all three.
   */
  const gazing = !!gaze && !!animate && !trio && !pair;

  /*
   * The pinned aim point, which is the cookie, and the last pointer position it
   * spawns at.
   *
   * Pinning answers a question the pointer cannot: **what does a field all
   * looking at one fixed thing read as?** That is a different question from the
   * one the pointer asks, because a field tracking the cursor is a field looking
   * at *you*, and "delightful or surveilled" is entirely about that. Aimed at a
   * heading, or a button, or a spot on the page, the same field is an audience
   * rather than a crowd watching you. That is the shape the layer would ship in
   * on a landing page, so it is worth being able to see.
   *
   * ## Why the target is drawn rather than invisible
   *
   * Because the thing being judged is whether four hundred blobatars are all
   * looking at the *same* place, and that is a question about convergence that
   * the eyes alone cannot answer: a field aimed 40px off reads exactly like a
   * field aimed correctly until you have something to check it against. The
   * cookie is that something. It is also what makes the layer's one genuine
   * failure mode visible: the stale-centre bug this file's `size` dependency
   * exists to prevent was invisible for exactly as long as there was nothing on
   * screen to see the eyes disagreeing with.
   *
   * ## Why the drag does not go through React
   *
   * `pinRef` is the live truth and `pinned` is only whether there is a cookie at
   * all. Putting the position in state would re-render the grid on every frame
   * of a drag, which at four hundred cells is four hundred components rebuilt to
   * move one emoji, on the harness whose entire purpose is measuring what this
   * layer costs, and it would land in the frame budget the readout reports.
   *
   * There is a subtler reason too. `setCost` renders this component every 250ms
   * while gazing, so a ref *synced from state on render* would be reset to the
   * pre-drag value four times a second, and the cookie would snap back. The ref
   * has to be the source and the render has to read it, not the other way round.
   */
  const cursor = useRef({ x: 0, y: 0 });
  const [pinned, setPinned] = useState(false);
  const pinRef = useRef<{ x: number; y: number } | null>(null);
  const cookieRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const gridRef = useRef<HTMLDivElement>(null);
  /*
   * The live options, read by the driver on every frame. A ref rather than a
   * dependency, because restarting the tracker to change `travel` would drop
   * every eye back to centre on each slider tick, and the whole reason these are
   * sliders is to retune a field that is already moving.
   */
  const tune = useRef<TrackOptions>({
    gate: "near", reach, travel, settle, snap: SNAP, wrap, at: null,
  });
  tune.current = {
    gate: gaze || "near", reach, travel, settle, snap: SNAP, wrap,
    at: pinRef.current,
  };

  const tracker = useRef<ReturnType<typeof track> | null>(null);

  useEffect(() => {
    if (!gazing || !gridRef.current) return;
    /*
     * The report arrives per frame and is only read by a human, so it is
     * buffered and sampled rather than pushed into React state directly. 400
     * blobatars at 60fps is 24,000 renders a second otherwise, which would make
     * the readout the most expensive thing on the page and the number it shows a
     * lie about everything else.
     */
    let latest: TrackStats | null = null;
    const t = track(gridRef.current, () => tune.current, (s) => (latest = s));
    tracker.current = t;
    const tick = setInterval(() => latest && setCost(latest), 250);
    return () => {
      clearInterval(tick);
      t.stop();
      tracker.current = null;
      setCost(null);
    };
  }, [gazing]);

  // The grid's contents changed under a running tracker: new seeds, or the
  // adapter swapping element types. Cheaper and far more precise than a
  // MutationObserver on a 400-cell subtree.
  //
  // `size` belongs here even though it swaps no element, and leaving it out was
  // a real bug: it is the grid's `auto-fill` track width, so changing it
  // reflows every cell to a new column count and a new position while the
  // driver keeps aiming at the centres it cached for the old layout. Nothing
  // fires `resize` or `scroll`, so nothing re-measures. The symptom is gaze
  // that looks *almost* right with the pointer far away, where the direction to
  // a centre 100px off is nearly the direction to the real one, and falls apart
  // as it gets close, where that offset is the whole vector, with the blobatar
  // nearest a *stale* centre freezing at rest because the driver thinks the
  // pointer is on top of it.
  useEffect(() => {
    tracker.current?.rescan();
  }, [seeds, animate, expr, bg, hue, size]);

  // The one option a settled field cannot notice on its own. Every other slider
  // is retuned while the pointer is moving the loop along anyway; this one is
  // changed by a click, which is exactly when nothing is running.
  useEffect(() => {
    tracker.current?.wake();
  }, [pinned]);

  /*
   * Culling. Only candidate B needs anything here — `auto` is a stylesheet rule
   * and the browser's own business, which is most of its case.
   *
   * Its own observer rather than a second job for the gaze driver's, because the
   * two answer different questions about different elements: the driver culls
   * *writes* to blobatars it is tracking, this culls *animations* on cells, and
   * it has to work with gaze switched off, which is where the cliff actually is.
   */
  const cullRef = useRef<ReturnType<typeof cull> | null>(null);
  useEffect(() => {
    if (culling !== "pause" || !animate || !gridRef.current) return;
    const c = cull(gridRef.current);
    cullRef.current = c;
    return () => {
      c.stop();
      cullRef.current = null;
    };
  }, [culling, animate]);
  useEffect(() => {
    cullRef.current?.rescan();
  }, [seeds, animate, expr, bg, hue, size]);

  return (
    // `mo-slow` sits here rather than on the grid so it also reaches the focus
    // sheet, which renders outside it — reviewing timing at a legible size is
    // most of what slow motion is for.
    <main className={slow ? "mo-slow" : undefined}>
      <header>
        <h1>blobatar</h1>
        <div className="controls">
          <label>
            shape
            <select
              value={shape}
              onChange={(e) => (setShape(e.target.value), setPage(0))}
            >
              {SHAPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            size {size}px
            <input
              type="range"
              min={24}
              max={200}
              step={4}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              // Pair and ballot cells carry their own fixed columns, for the
              // reasons above them, so there is nothing here for this to set.
              disabled={!!pair || !!trio}
            />
          </label>
          <label>
            count
            <select
              value={shown}
              onChange={(e) => (setShown(Number(e.target.value)), setPage(0))}
              disabled={!!pair || !!trio}
            >
              {/*
                Doubling, because what is being looked for is a cliff and a cliff
                is found by bracketing it. 400 stays on the list and is no longer
                the default: it is the number that stutters a real laptop with
                `always` on, which makes it worth keeping and wrong to start at.
                It costs nothing with `animate` off, which is still the default,
                so the static tuning grid this harness was built for is unchanged.
              */}
              {[25, 50, 100, 200, 400, 800].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            {/*
              All three cull the *idle* layers, which is where the cliff is, and
              they are not the same size. `pause unhovered` is the default and
              the only one that reaches a resting page: 200 blobatars sit at
              ~18fps doing nothing at all, because `animate="hover"` pauses
              nothing — it gates amplitude, not animation — and pausing them
              properly puts that back to 60.

              The two offscreen options are much smaller and only bite once the
              grid is taller than the window: at 64px cells a 1440x900 viewport
              holds about two hundred blobatars, so below that count there is
              nothing offscreen and neither can do a thing. Measurements and the
              rest of the argument are in `offscreen.ts`.

              None of them is inert in `animate="always"` by accident: `unhovered`
              excludes `.mo-always` on purpose, because a blobatar told to move
              regardless of the pointer is one this must not stop.
            */}
            offscreen
            <select
              value={culling}
              onChange={(e) => setCulling(e.target.value as Cull)}
              disabled={!animate}
            >
              <option value="">render</option>
              <option value="auto">skip offscreen</option>
              <option value="pause">pause offscreen</option>
              <option value="unhovered">pause unhovered</option>
            </select>
          </label>
          <label>
            seed prefix
            <input
              value={prefix}
              onChange={(e) => (setPrefix(e.target.value), setPage(0))}
            />
          </label>
          <label>
            background
            <select value={bg} onChange={(e) => setBg(e.target.value as Bg)}>
              {(
                ["default", "squircle", "circle", "square", "none"] as Bg[]
              ).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={hue !== ""}
              onChange={(e) => setHue(e.target.checked ? 200 : "")}
            />
            lock hue
          </label>
          <label>
            <input
              type="range"
              min={0}
              max={360}
              value={hue === "" ? 0 : hue}
              onChange={(e) => setHue(Number(e.target.value))}
              disabled={hue === ""}
            />
          </label>
          <label>
            animate
            <select
              value={animate}
              onChange={(e) => setAnimate(e.target.value as Animate | "")}
            >
              <option value="">off</option>
              <option value="hover">hover</option>
              <option value="always">always</option>
            </select>
          </label>
          <label>
            expression
            <select
              value={expr}
              onChange={(e) =>
                setExpr(e.target.value as keyof typeof EXPRESSIONS)
              }
            >
              {Object.keys(EXPRESSIONS).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={slow}
              onChange={(e) => setSlow(e.target.checked)}
              // The ballot animates whatever the `animate` control says, so the
              // one control that matters most for judging it must not be greyed
              // out along with that one. Timing is most of what is being voted
              // on, and 5× is where a 91ms saccade becomes something an eye can
              // actually inspect.
              disabled={!animate && !trio}
            />
            5× slower
          </label>
          <label>
            gaze
            <select
              value={gaze}
              onChange={(e) => setGaze(e.target.value as Gate | "")}
              // Needs the inline-SVG branch to have something to attach to, and
              // the ballot is deliberately excluded. See `gazing`.
              disabled={!animate || !!trio || !!pair}
            >
              <option value="">off</option>
              <option value="near">near</option>
              <option value="all">all</option>
            </select>
          </label>
          <label>
            reach {reach}px
            <input
              type="range"
              min={80}
              max={900}
              step={10}
              value={reach}
              onChange={(e) => setReach(Number(e.target.value))}
              // Under `all` there is no falloff to set, which is the entire
              // difference between the two gates.
              disabled={gaze !== "near"}
            />
          </label>
          <label>
            travel {travel.toFixed(1)}
            <input
              type="range"
              min={0}
              // Was 5, which turned out to be where it looked right, and a dial
              // whose best setting is its own ceiling is a dial that has not been
              // asked the question yet. The headroom is there to find out whether
              // 5 is a peak or a plateau; the eyes crossing the silhouette is the
              // real limit and `motion.css` is explicit that it reads as a face
              // turning rather than as a mistake.
              max={8}
              step={0.1}
              value={travel}
              onChange={(e) => setTravel(Number(e.target.value))}
              disabled={!gazing}
            />
          </label>
          <label>
            settle {settle}ms
            <input
              type="range"
              min={0}
              max={400}
              step={10}
              value={settle}
              onChange={(e) => setSettle(Number(e.target.value))}
              disabled={!gazing}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={pinned}
              // Spawns the cookie where the pointer already is, so ticking never
              // costs a hunt for where the thing went. The fallback is for the
              // one case that has no answer: ticking before the pointer has ever
              // been over the grid, where "where the pointer is" is a lie the
              // ref would tell as 0,0.
              onChange={(e) => {
                pinRef.current = e.target.checked
                  ? cursor.current.x || cursor.current.y
                    ? { ...cursor.current }
                    : { x: innerWidth / 2, y: innerHeight / 2 }
                  : null;
                setPinned(e.target.checked);
              }}
              disabled={!gazing}
            />
            cookie
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(e) => setWrap(e.target.checked)}
              disabled={!gazing}
            />
            sphere
          </label>
          <label>
            {/*
              1× is an idle glance's worth of projection. Above 1 is the question:
              a look three times the length of a saccade, wearing three times the
              foreshortening or the same amount of it.
            */}
            amount {sphere.toFixed(1)}×
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={sphere}
              onChange={(e) => setSphere(Number(e.target.value))}
              disabled={!gazing || !wrap}
            />
          </label>
          <label>
            {/*
              Its own dial rather than riding `amount`, because it is the cue with
              the identity risk. The seeded lean reaches 12° and carries who the
              blobatar is; `motion.css` puts the idle wrap's tilt peak at 2.4° and
              says an animated tilt approaching the lean stops decorating the
              blobatar and starts overwriting it. This slider is where that line
              gets found.
            */}
            tilt {tilt.toFixed(1)}°
            <input
              type="range"
              min={0}
              max={6}
              step={0.1}
              value={tilt}
              onChange={(e) => setTilt(Number(e.target.value))}
              disabled={!gazing || !wrap}
            />
          </label>
          <div className="spacer" />
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ←
          </button>
          <code>page {page + 1}</code>
          <button onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
        <p className="stats">
          {seeds.length} blobatars · svg {stats.min}–{stats.max} bytes (avg{" "}
          {stats.avg}){hue !== "" && ` · hue ${hue}°`}
          {/*
            The cost half of the question, and it reports two numbers because one
            of them lied.

            `js` is the driver's own callback and it is reassuringly small at any
            count, which is exactly why it was the wrong thing to quote: it stops
            timing at the moment the writes return, and everything they provoke —
            a style recalculation on every subtree whose registered custom
            properties changed, then paint and composite — lands after that.
            `fps` is the frame interval, which cannot miss any of it, because the
            browser does not get to schedule the next frame until the last one's
            consequences are done.

            Quote `fps`. The gap between the two is the whole finding.

            `rest` still matters and is still true: a settled field runs no rAF
            at all, so the idle cost of leaving gaze on is zero rather than
            small. It is the *moving* cost that has a cliff in it.
          */}
          {cost && (
            <>
              {" · gaze "}
              {cost.live}/{cost.total} on screen · {cost.writes} writes ·{" "}
              {cost.running && cost.frame > 0 ? (
                <strong>
                  {(1000 / cost.frame).toFixed(0)} fps ({cost.frame.toFixed(1)}ms)
                </strong>
              ) : (
                "at rest"
              )}{" "}
              · {cost.ms.toFixed(2)}ms js
            </>
          )}
        </p>
      </header>

      <div
        ref={gridRef}
        className="grid"
        // Where the pin is captured from. React's delegated listener writing one
        // ref is cheap enough to leave on unconditionally, and cheaper than the
        // window listener the alternative needs: the driver has the pointer
        // already, but reaching it would mean putting a per-frame value through
        // `TrackStats`, which is documented as a cost readout and should stay
        // one.
        onPointerMove={(e) => {
          cursor.current.x = e.clientX;
          cursor.current.y = e.clientY;
        }}
        // The gaze layer's only hook. An attribute React owns rather than a
        // class the driver adds: see the header of `pointer.ts` for the failure
        // that rule comes from. It also gates the layer, so `pointer.css` simply
        // does not apply on a render where gaze is off.
        data-gaze={gazing ? gaze : undefined}
        // Inert without it, so "render" is genuinely the grid as it was.
        data-cull={animate && culling ? culling : undefined}
        // `--mo-track-travel` is declared once here and inherits into every
        // blobatar, so retuning the excursion is one style write rather than
        // four hundred. The driver only ever writes the direction.
        style={
          {
            gridTemplateColumns: cols
              ? `repeat(${cols}, 1fr)`
              : `repeat(auto-fill, ${size}px)`,
            ...(gazing ? { "--mo-track-travel": `${travel}px` } : null),
            ...(gazing && wrap
              ? {
                  "--mo-track-fx": SPHERE_X * sphere,
                  "--mo-track-fy": SPHERE_Y * sphere,
                  "--mo-track-fd": SPHERE_X * sphere * SPHERE_DIFF,
                  "--mo-track-ft": tilt,
                }
              : null),
          } as CSSProperties
        }
      >
        {seeds.map((seed) =>
          trio ? (
            // Always `animate="always"`, whatever the `animate` control says.
            // Two of these three exist only as motion — a still `look away` is
            // just eyes off to one side, and a still `orbit` is eyes riding
            // high — so a frozen ballot would collect votes on the one thing
            // none of the candidates is about.
            <button
              key={seed}
              className="cell trio"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              {trio.map(([label, e]) => (
                <span key={label}>
                  <Blobatar
                    name={seed}
                    animate="always"
                    {...opts}
                    expression={e}
                  />
                  <em>{label}</em>
                </span>
              ))}
            </button>
          ) : pair ? (
            // Both halves are the same seed, so every difference on screen is the
            // expression and nothing else. Rendered through the string API even
            // when animating: this mode is for judging the two *poses* against
            // each other, and idle motion running underneath them is noise on
            // exactly the comparison being made.
            <button
              key={seed}
              className="cell pair"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              {pair.map((e, i) => (
                <span
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: blobatar(seed, { ...opts, expression: e }),
                  }}
                />
              ))}
            </button>
          ) : animate ? (
            // Goes through the real adapter rather than the string API, because
            // the inline-SVG branch is the thing worth exercising here.
            <button
              key={seed}
              className="cell"
              title={seed}
              onClick={() => setFocus(seed)}
            >
              <Blobatar name={seed} animate={animate} {...opts} />
            </button>
          ) : (
            <button
              key={seed}
              className="cell"
              title={seed}
              onClick={() => setFocus(seed)}
              dangerouslySetInnerHTML={{ __html: blobatar(seed, opts) }}
            />
          ),
        )}
      </div>

      {/*
        The cookie: the thing the field is looking at, made visible so that
        "are they all pointing at it" is a question the eye can actually answer.

        Rendered outside the grid and positioned `fixed`, because the aim point
        is in client coordinates and this has to agree with the driver about what
        those mean. Inside the grid it would be a positioned box inside a
        scrolling flow, which is the same coordinate space by accident and not by
        construction.

        Gated on `gazing` as well as on the box, so switching gaze off does not
        leave a target on screen for a layer that is no longer aiming at it. The
        box stays ticked and disabled, so turning gaze back on brings the cookie
        back where it was rather than making you place it again.

        The transform is written from `pinRef` on render *and* directly by the
        drag below. That is not two sources of truth: `pinRef` is the source and
        both of these read it, so the render that `setCost` provokes mid-drag
        recomputes the same position the drag already wrote rather than the one
        the last render happened to see.
      */}
      {pinned && gazing && pinRef.current && (
        <div
          ref={cookieRef}
          className="cookie"
          role="img"
          aria-label="gaze target"
          title="drag me"
          style={{
            transform: `translate(${pinRef.current.x}px, ${pinRef.current.y}px) translate(-50%, -50%)`,
          }}
          onPointerDown={(e) => {
            // Capture, so the drag survives the pointer outrunning a 34px
            // emoji, which it does immediately. Without this the cookie is
            // left behind on the first fast move.
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const at = { x: e.clientX, y: e.clientY };
            pinRef.current = at;
            // `tune.current` is rebuilt on every render from `pinRef`; this is
            // the same assignment for the frames where there is no render, which
            // during a drag is all of them.
            tune.current.at = at;
            const el = cookieRef.current;
            if (el) {
              el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
            }
            // The field is settled between drag frames, so without this the
            // cookie moves and nothing follows it. See `Tracker.wake`.
            tracker.current?.wake();
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          🍪
        </div>
      )}

      {focus && (
        <div className="sheet" onClick={() => setFocus(null)}>
          <div className="card" onClick={(e) => e.stopPropagation()}>
            {/*
              Animated at "always" whenever animation is on at all. A modal has
              no grid to sweep, so "hover" would mean the blobatar you opened to
              look at sits perfectly still — and the whole point of opening it
              is to watch the motion at a size where it is legible.
            */}
            {trio ? (
              <div className="big trio">
                {trio.map(([label, e]) => (
                  <span key={label}>
                    <Blobatar
                      name={focus}
                      animate="always"
                      {...opts}
                      expression={e}
                    />
                    <em>{label}</em>
                  </span>
                ))}
              </div>
            ) : pair ? (
              <div className="big pair">
                {pair.map((e, i) => (
                  <span
                    key={i}
                    dangerouslySetInnerHTML={{
                      __html: blobatar(focus, { ...opts, expression: e }),
                    }}
                  />
                ))}
              </div>
            ) : animate ? (
              <div className="big">
                <Blobatar name={focus} animate="always" {...opts} />
              </div>
            ) : (
              <div
                className="big"
                dangerouslySetInnerHTML={{ __html: blobatar(focus, opts) }}
              />
            )}
            <div className="meta">
              <strong>{focus}</strong>
              <span>
                {blobatar(focus, opts).length} bytes ·{" "}
                {silhouetteOf(focus)}
              </span>
              <div className="swatches">
                {[
                  ...new Set(blobatar(focus, opts).match(/#[0-9a-f]{6}/g) ?? []),
                ].map((c) => (
                  <span key={c} style={{ background: c }} title={c} />
                ))}
              </div>
              <textarea readOnly value={blobatar(focus, opts)} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
