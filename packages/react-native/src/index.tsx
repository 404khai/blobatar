/**
 * `@blobatar/react-native`, the React Native and Expo adapter.
 *
 * ## Why this one holds a component when `@blobatar/react` does not
 *
 * `@blobatar/react` is an alias: the component still lives in `blobatar/react`
 * until v3, because that subpath shipped with consumers and core cannot depend
 * on a package that peer-depends on core (ADR-0009). Nothing analogous is true
 * here. There is no `blobatar/react-native` subpath and there never will be.
 * ADR-0009 freezes core's optional peer list at `react` and `vue`, and the
 * moment a third adapter subpath appears the peer list resumes growing and the
 * reason for splitting is gone. So this package holds the real implementation
 * from its first release, the way Solid and Preact do.
 *
 * ## Why it draws elements rather than parsing a string
 *
 * Neither of the two rendering modes the DOM adapters use survives the port.
 * The static one is an `<img>` carrying a `data:image/svg+xml` URI, and React
 * Native's `<Image>` does not decode SVG. The animated one hands `parts.inner`
 * to `dangerouslySetInnerHTML`, and there is no `innerHTML` here at all.
 *
 * `react-native-svg` ships an `SvgXml` that would parse `blobatar()`'s string
 * at runtime, and that was the obvious shape and the wrong one: it puts an XML
 * parser between the renderer and the screen, which is a place the picture can
 * change, and ADR-0009 is explicit that an adapter adds no geometry of its own.
 * So core grew `_marks`, the same figure as drawing primitives, and this file
 * maps them onto elements. What crosses the boundary is data core produced,
 * not markup something re-interpreted.
 *
 * Every silhouette in gen2 draws with `<path>` and `<circle>` and nothing else:
 * no gradients, no filters, no masks, no `currentColor`. That is what makes the
 * mapping total rather than approximate.
 *
 * ## Why it imports no React Native module at all
 *
 * The only two imports here are `react` and `react-native-svg`, and the morph
 * below keeps it that way on purpose. `react-native`'s own entry point is
 * Flow-typed source that Bun cannot parse, which is why `packages/harness`
 * renders this adapter through a stub, so every runtime import of it is a
 * component this workspace can no longer test. `Animated` and `Easing` would
 * have bought a timing loop and a bezier that are together forty lines, at the
 * cost of the only instrument that checks this adapter draws the same blobatar
 * as every other one. `requestAnimationFrame` is a global on this platform and
 * needs no import, so that is what drives the morph.
 *
 * The one thing that trade genuinely costs is reading the OS reduced-motion
 * setting, which lives on `AccessibilityInfo`. See `morph` below for where
 * that lands instead.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  _marks,
  _posed,
  fadeHex,
  lerpPose,
  poseTransforms,
  type BlobatarOptions,
  type Mark,
  type Pose,
} from "blobatar/internal";
import { idleAt, idleSeeds, idleTransforms } from "blobatar/idle";
import Svg, { Circle, G, Path, type SvgProps } from "react-native-svg";

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id. Any string, and the same string always renders the
   * same blobatar.
   */
  name: string;
  /**
   * How big to draw it, in points. **Required here, and optional in every
   * other adapter.**
   *
   * On the web, omitting it emits no `width`/`height` and lets CSS size the
   * element, and the viewBox scales to whatever the page decides. React Native has
   * no such fallback, so an unsized `<Svg>` is at best ambiguous and at worst
   * zero pixels of nothing.
   *
   * The alternative was defaulting it here, and that is the one thing ADR-0009
   * says an adapter may never do: a default size is a default that changes the
   * picture, and the core is the only place a default is written down. Making
   * it required moves the platform difference to a compile error at the call
   * site, where it is visible, instead of a blank square at runtime.
   */
  size: number;
} & Omit<BlobatarOptions, "animate" | "size"> &
  /**
   * `title` is dropped from the passthrough because `SvgProps` declares one of
   * its own and it is not this one. Ours is the screen-reader label every
   * adapter takes, and it is mapped onto React Native's accessibility props
   * below rather than onto an element, because `react-native-svg` has no
   * `<title>`.
   *
   * `viewBox` is dropped because the geometry is drawn in a fixed 100×100 space
   * and a caller who changes it gets a cropped blobatar, not a resized one:
   * `size` is the prop for that. `children` because there is nothing to put
   * inside a blobatar.
   */
  Omit<SvgProps, "viewBox" | "children" | "title">;

/**
 * The two clocks, quoted from `.mo-root.mo-expr` and `.mo-root` in
 * `motion.css`, which is the only other place they are written down.
 *
 * They are copied rather than shared, and nothing can fix that: one of the two
 * renderings of this motion is a stylesheet, so there is no constant a build
 * step could hand to both. What there is instead is this comment and the one
 * beside those rules, and a note there pointing here. **Change them together.**
 *
 * The curve is the part worth not guessing at. `motion.css` documents why it is
 * not the obvious hard ease-out: the pose channels do not all travel the same
 * distance, so a front-loaded curve finishes the eye's squash before the eye
 * appears to have left, and the morph reads as a cut rather than as a fast
 * transition. `ease-in-out` on the way back is CSS's own keyword, spelled here
 * as the bezier it stands for.
 */
const IN = { ms: 300, ease: [0.45, 0.05, 0.5, 1] } as const;
const OUT = { ms: 400, ease: [0.42, 0, 0.58, 1] } as const;

/**
 * `ease-out`, for the amplitude ramp. From `.mo-root`'s
 * `transition-timing-function` on `--mo-amp`, and the one curve in this file
 * that belongs to the idle layer rather than to the morph.
 *
 * Built inside the component that uses it rather than once at module scope, and
 * that is a size decision rather than a style one: `bezier(...)` is a *call*, a
 * bundler will not drop a call it cannot prove side-effect-free, and a
 * module-scope one put the solver into the still and morphing rows too. The
 * size gate caught it, which is what those two rows are for.
 */
const easeOut = () => bezier([0, 0, 0.58, 1]);

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)`, as a function of elapsed fraction.
 *
 * The curve is a parametric Bézier, so reading `y` at a given `x` means solving
 * for the parameter first, which is what the Newton loop does, from `x` itself
 * as the starting guess. That guess is exact for `linear` and close for
 * everything with control points inside the unit square, so eight iterations is
 * generous; the loop normally exits on the second or third.
 *
 * Both fallbacks return the current estimate rather than throwing or clamping.
 * A stalled derivative means the curve is flat there, where the estimate is as
 * good as any answer, and this is a frame of an animation rather than a place
 * to be principled at the cost of a visible glitch.
 */
function bezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = ((ax * t + bx) * t + cx) * t - x;
      if (Math.abs(err) < 1e-5) break;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

/** The two colours a morph travels between, in the order the marks carry them. */
type Fill = { head: string; eye: string };

/**
 * The outer element, and everything about it that has nothing to do with the
 * pose.
 *
 * Shared by both bodies below rather than duplicated, because the accessibility
 * mapping is the part most likely to be corrected once and forgotten in the
 * other copy.
 */
function Frame({
  size,
  title,
  rest,
  children,
}: {
  size: number;
  title?: string;
  rest: SvgProps;
  children: ReactNode;
}) {
  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      /*
        The label, and the call the DOM adapters make with `role`/`aria-hidden`,
        made again in React Native's vocabulary. With a `title` this is an image
        with a name; without one it is decoration, and a screen reader that
        walks into a dozen unnamed paths is worse than one that never sees them.

        Both platform spellings of "skip this subtree" are set, because they are
        not aliases: `accessibilityElementsHidden` is iOS and
        `importantForAccessibility` is Android, and setting one leaves the other
        platform reading the shapes.
      */
      accessible={title ? true : undefined}
      accessibilityRole={title ? "image" : undefined}
      accessibilityLabel={title}
      accessibilityElementsHidden={title ? undefined : true}
      importantForAccessibility={title ? undefined : "no-hide-descendants"}
      // Last, so a caller who writes an explicit `width` or `accessibilityLabel`
      // overrides what the props derived. The same rule every other adapter
      // follows, and one `packages/harness` asserts across all of them.
      {...rest}
    >
      {children}
    </Svg>
  );
}

/**
 * The still blobatar, unchanged since this package's first release and
 * deliberately still on `_marks`.
 *
 * It could have been the morphing body frozen at `t = 1`, and that would have
 * been one code path instead of two and a slightly different picture: a baked
 * path rounds after composing the pose and a transformed one rounds before, so
 * the two agree to a hundredth of a unit rather than exactly. A hundredth of a
 * unit is invisible and the equivalence this package is held to is not: the
 * harness compares this adapter's output against `@blobatar/react`'s primitive
 * for primitive, and "equal" there means equal. Adding a morph is not a reason
 * to move a still blobatar by a rounding step.
 */
function Still({
  seed,
  size,
  title,
  opts,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _marks(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );

  const body = figure.marks.map((m, i) =>
    m.kind === "circle" ? (
      <Circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} />
    ) : (
      <Path key={i} d={m.d} fill={m.fill} />
    ),
  );

  return (
    <Frame size={size} title={title} rest={rest}>
      {/*
        Outside the pose wrap, matching every other renderer: a plate that leans
        and scales with the creature stops being a plate.
      */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      {/*
        `transform` is the pose's body wrap and it is load-bearing rather than
        decorative. `expression.bake` returns a `translate(0 N)` for any pose
        that shifts the body, and drawing the marks without it puts every posed
        blobatar in the wrong place. It is the only transform in the figure: an
        eye's rotation is baked into the points of its path, not carried as an
        attribute.
      */}
      {figure.transform ? <G transform={figure.transform}>{body}</G> : body}
    </Frame>
  );
}

/**
 * The morph as a state machine with no clock of its own.
 *
 * A hook rather than a component, and it hands back a `step` instead of running
 * a loop, because there are two callers and only one of them owns the only
 * clock. `MorphingBlobatar` runs a frame loop while a morph is in flight and
 * stops. `AnimatedBlobatar` is already running one forever, and a second loop
 * beside it would be two `requestAnimationFrame` callbacks per blobatar per
 * frame, setting state twice, to draw one picture.
 *
 * So the clock is the caller's and the bookkeeping is here. That is what keeps
 * the two components from each carrying their own copy of interrupt handling,
 * which is the part with the subtle rule in it.
 *
 * State holds *what is on screen*, not a progress fraction, and that is what
 * makes an interrupted morph correct without a special case. Setting a new
 * expression half way through the last one starts from wherever the face
 * actually is, so poses chained faster than 300ms flow into each other instead
 * of snapping back to a start the consumer never saw.
 */
function useMorph(
  figure: ReturnType<typeof _posed>,
  seed: string,
  opts: Omit<BlobatarOptions, "animate" | "size">,
) {
  // Where the morph is heading. `hot` is already the finished colour at the
  // pose's own `heat`, so there is no mix left to do here. The travel is from
  // whatever is on screen to these two values, on the morph's own clock, which
  // is exactly what `transition: fill` does on the web.
  const to: Fill = {
    head: figure.hot?.head ?? figure.fill.head,
    eye: figure.hot?.eye ?? figure.fill.eye,
  };
  const [shown, setShown] = useState({
    pose: lerpPose(undefined, figure.pose, 1),
    fill: to,
  });
  // The latest committed frame, readable by a caller that has to start from it.
  // A morph interrupted mid-flight begins where the face is, and the face is
  // here.
  const at = useRef(shown);
  at.current = shown;

  // Identity is not enough: `figure` is rebuilt whenever any option changes, so
  // a palette tweak would hand back an equal pose in a new object and start a
  // 300ms morph from a pose to itself. The colours are in the key because a
  // palette change *is* something to fade, and the same key drives both.
  const key = JSON.stringify([figure.pose ?? null, to]);
  // Which blobatar this is, which is every option except the expression.
  //
  // A morph is a change of *expression* on one creature. Handing a component a
  // different `name` is not that: it is a different creature in the same slot,
  // which React does routinely when a list re-renders over new data. That has
  // to cut, and without this it would not quite: the geometry would snap while
  // the colours eased, so one person's palette would fade into another's.
  const ident = JSON.stringify([seed, { ...opts, expression: null }]);

  const seen = useRef(key);
  const seenIdent = useRef(ident);
  const run = useRef<{
    from: { pose: Pose; fill: Fill };
    start: number;
    ms: number;
    ease: (x: number) => number;
  } | null>(null);

  // Decided during render rather than in an effect, so the frame loop a caller
  // starts on this token already has something to do on its first tick. An
  // effect would be a frame late, which is invisible and is also how a loop
  // that stops on "nothing moving" can stop before it ever starts.
  if (seen.current !== key || seenIdent.current !== ident) {
    const cut = seenIdent.current !== ident;
    seen.current = key;
    seenIdent.current = ident;
    if (cut) {
      // A different creature, so there is nothing to travel from.
      run.current = null;
      at.current = { pose: lerpPose(undefined, figure.pose, 1), fill: to };
    } else {
      // Adopting an expression is quick and returning to idle is slower, and
      // the asymmetry is deliberate. See `IN`/`OUT` above.
      const clock = figure.expr ? IN : OUT;
      run.current = { from: at.current, start: 0, ms: clock.ms, ease: bezier(clock.ease) };
    }
  }

  /** Advance to `now`. Returns whether there is still somewhere to go. */
  const step = (now: number) => {
    const r = run.current;
    if (!r) {
      // The cut case, and the mount case. Commit whatever `at` holds, once.
      if (at.current !== shown) setShown(at.current);
      return false;
    }
    // The first callback establishes the origin rather than assuming one.
    // `requestAnimationFrame`'s timestamp is not wall-clock on this platform
    // and subtracting a separately-read `now` from it drifts.
    if (!r.start) r.start = now;
    const u = Math.min(1, (now - r.start) / r.ms);
    const k = r.ease(u);
    setShown({
      pose: lerpPose(r.from.pose, figure.pose, k),
      fill: {
        head: fadeHex(r.from.fill.head, to.head, k),
        eye: fadeHex(r.from.fill.eye, to.eye, k),
      },
    });
    if (u >= 1) run.current = null;
    return u < 1;
  };

  return { shown, step, token: `${key}|${ident}` };
}

/**
 * The morphing blobatar.
 *
 * The whole of the animation is here and none of the motion is: what travels is
 * the thirteen numbers of a `Pose` plus two colours, and core turns those into
 * one transform per eye. No path data is regenerated on any frame, which is the
 * same property the web side has and the reason a morph is affordable at all.
 * `_posed` hands back the figure as drawn, once, and every frame after that is
 * a string on a `<G>`.
 */
function Morphing({
  seed,
  size,
  title,
  opts,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _posed(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );
  const { shown, step, token } = useMorph(figure, seed, opts);
  const first = useRef(true);

  useEffect(() => {
    // Nothing to morph from on the way in. A blobatar that eased out of idle on
    // mount would animate a whole grid of them on first paint, which is the
    // web's rule too: transitions do not run on an element's first style
    // resolution.
    if (first.current) {
      first.current = false;
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      if (step(now)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const t = poseTransforms({ eyes: figure.eyeFrames }, shown.pose);

  return (
    <Frame size={size} title={title} rest={rest}>
      {/* Outside the pose wrap, for the reason `Still` gives. */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      {/*
        `wrap` is emitted on every pose here, including the identity, where
        `_marks` emits nothing. That is not an oversight and core's
        `poseTransforms` documents it: `bdy` passes through nonzero between two
        poses that both sit at zero, and a group that appears mid-morph is a
        reparent rather than a translate.
      */}
      <G transform={t.wrap}>
        <Body marks={figure.marks} fill={shown.fill.head} />
        {figure.eyes.map((m, i) => (
          <G key={i} transform={t.eyes[i]}>
            <Path d={m.d} fill={shown.fill.eye} />
          </G>
        ))}
      </G>
    </Frame>
  );
}

/**
 * The animated blobatar: the idle layer, and the morph along with it.
 *
 * Six levels of group, which is the same tree `motion.css` decorates, and every
 * level of it earns its place by having a different origin or a different
 * clock. `idleTransforms` in core says which is which; this file puts the
 * strings it returns onto elements and adds nothing.
 *
 * One `requestAnimationFrame` loop drives both layers, because there is one
 * picture per frame and computing it twice to set state twice is the cost that
 * matters here rather than the arithmetic, which is about thirty numbers.
 */
function Animated({
  seed,
  size,
  title,
  opts,
  on,
  rest,
}: {
  seed: string;
  size: number;
  title?: string;
  opts: Omit<BlobatarOptions, "animate" | "size">;
  on: boolean;
  rest: SvgProps;
}) {
  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _posed(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );
  const seeds = useMemo(
    () => idleSeeds(seed, { normalize: opts.normalize, traits: opts.traits }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, JSON.stringify(opts.traits ?? null), opts.normalize],
  );
  const { shown, step, token } = useMorph(figure, seed, opts);

  // The frame the blobatar is at rest: no amplitude, no tremor, and the seesaw
  // at the extreme the still renderer bakes. `idleAt` at time zero *is* that
  // frame, so there is no second definition of what rest looks like.
  const REST = useMemo(() => idleAt(seeds, 0, 0, 0), [seeds]);
  const [frame, setFrame] = useState(REST);

  // Amplitude ramps rather than switching, which is `.mo-root`'s own
  // `transition: --mo-amp 400ms ease-out`. Turning the loops on by assignment
  // makes a blobatar start breathing at full depth mid-breath, and turning them
  // off that way stops it mid-breath, which reads as a fault rather than as
  // something settling.
  const amp = useRef({ from: 0, to: on ? 1 : 0, start: 0 });
  const ease = useMemo(easeOut, []);

  useEffect(() => {
    amp.current = { from: ampNow(amp.current, 0, ease), to: on ? 1 : 0, start: 0 };
    let raf = 0;
    const tick = (now: number) => {
      if (!amp.current.start) amp.current.start = now;
      const a = ampNow(amp.current, now, ease);
      const moving = step(now);
      setFrame(idleAt(seeds, now, a, shown.pose.shake));
      // Keep going while anything is still moving: the loops themselves, the
      // amplitude easing out behind them, or a morph. When all three are done
      // there is nothing left to draw and the loop ends rather than spinning on
      // a still picture.
      if (on || moving || a > 0) raf = requestAnimationFrame(tick);
      else setFrame(REST);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, on, seeds]);

  const t = idleTransforms({ eyes: figure.eyeFrames }, shown.pose, frame);

  return (
    <Frame size={size} title={title} rest={rest}>
      {/* Outside every layer of the motion, matching every other renderer: a
          plate that breathes and bobs with the creature stops being a plate. */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      <G transform={t.root}>
        <G transform={t.breathe}>
          <G transform={t.bob}>
            <Body marks={figure.marks} fill={shown.fill.head} />
            <G transform={t.eyes}>
              {figure.eyes.map((m, i) => (
                <G key={i} transform={t.eye[i]}>
                  {/*
                    One more group per eye than the morph needs, and it is not
                    optional. The blink and the glance's foreshortening are
                    about the eye's own drawn centre, where the pose above is
                    about the pair's frame, and collapsing the two is how the
                    eye-scale bug in `motion.css`'s own history happened.
                  */}
                  <G transform={t.glance[i]}>
                    <Path d={m.d} fill={shown.fill.eye} />
                  </G>
                </G>
              ))}
            </G>
          </G>
        </G>
      </G>
    </Frame>
  );
}

/** Where an amplitude ramp has got to, on `.mo-root`'s own 400ms ease-out. */
function ampNow(
  r: { from: number; to: number; start: number },
  now: number,
  ease: (x: number) => number,
) {
  if (!r.start || r.from === r.to) return r.to;
  const u = Math.min(1, (now - r.start) / 400);
  return r.from + (r.to - r.from) * ease(u);
}

/**
 * Everything that is not an eye, which is one fill and no motion of its own.
 *
 * Shared by the two animated bodies, where the fill is a value that travels.
 * The still one keeps its own copy deliberately: it is the row the size gate
 * holds at its pre-morph number, and an indirection it does not need is exactly
 * what that row exists to notice.
 */
function Body({ marks, fill }: { marks: Mark[]; fill: string }) {
  return (
    <>
      {marks.map((m, i) =>
        m.kind === "circle" ? (
          <Circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={fill} />
        ) : (
          <Path key={i} d={m.d} fill={fill} />
        ),
      )}
    </>
  );
}

/**
 * The options core reads, split away from everything that goes on the element.
 *
 * Shared by the two components below rather than written twice, because it is a
 * list of option names and a list of option names is the thing that silently
 * goes stale in a second copy: a new option added to core reaches both or
 * neither.
 *
 * The three that are not in `opts` are not oversights: core reads none of them.
 * Size is an attribute on the outer element, the label has nowhere to go in a
 * mark, and `name` is the seed rather than an option. What is left in `rest`
 * goes straight onto the `<Svg>`, which is why `traits` is pulled out
 * explicitly: a traits object spread onto a native component is a prop the
 * view bridge has no idea what to do with.
 */
function split({
  name: seed,
  size,
  background,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  expression,
  traits,
  ...rest
}: BlobatarProps) {
  return {
    seed,
    size,
    title,
    opts: { background, palette, hue, tone, normalize, contrast, expression, traits },
    rest,
  };
}

/**
 * A blobatar.
 *
 * There is no `animate` prop, and its absence is the API rather than an
 * oversight.
 *
 * Blobatar's *idle* motion is a stylesheet: `motion.css`, a root class, and a
 * dozen seeded custom properties the CSS reads. React Native has no stylesheet,
 * no custom properties and no CSS transitions, so there is nothing here for
 * `animate` to switch on. Re-expressing the idle spec against Reanimated would
 * make it exist twice, in two languages, drifting, which is the failure
 * ADR-0009 refuses everywhere else. `animate="hover"`, which is the recommended
 * default for a grid on the web, does not even have a trigger on a touch
 * screen.
 *
 * So the prop is absent from the type instead of accepted and ignored. Passing
 * `animate` is a compile error naming this package, which is the cheapest place
 * to learn it.
 *
 * `expression` works fully, and statically: a pose bakes into the geometry
 * before it reaches the marks, which is why it survives here for the same
 * reason it survives in the string API. Setting a new one cuts to it. To
 * animate that change instead, reach for `MorphingBlobatar`, and read there
 * why it is a second component rather than a prop on this one.
 */
export function Blobatar(props: BlobatarProps) {
  return <Still {...split(props)} />;
}

/**
 * A blobatar that animates the change from one `expression` to the next
 * instead of cutting to it.
 *
 * Identical to `Blobatar` in every other way, including its props, and a
 * separate export rather than a `morph` prop for one measured reason: the
 * morph is about 1.1 kB gz of machinery, and a prop on a single component is
 * reachable from that component whether or not anybody passes it, so every
 * consumer would carry it. Two components means a bundler drops all of it for
 * an app that never names this one. `packages/harness/scripts/size.ts` gates
 * both numbers, and the row for `Blobatar` is what says the still path stayed
 * free.
 *
 * That is the same trade the roster makes by having expressions be values a
 * consumer imports rather than strings a renderer looks up, and the same one
 * `_marks` and `_posed` make in core.
 *
 * Timed and curved to match `motion.css` exactly: 300ms adopting an
 * expression, 400ms returning to idle, because an expression is a message the
 * consumer sent and yanking it off the face reads as a glitch rather than as a
 * creature settling. The morph itself is core's, channel for channel, and
 * `test/morph.test.ts` there holds a frozen frame of it against the static
 * renderer at every pose.
 *
 * **Reduced motion is the caller's to honour**, by rendering `Blobatar`
 * instead, and the header above says why this file cannot read the setting
 * itself. React Native exposes it as
 * `AccessibilityInfo.useReduceMotionEnabled()` in an app that already imports
 * `react-native`, which makes the whole of it one ternary at the call site.
 * Swapping components mid-morph lands on the target pose immediately, which is
 * what the stylesheet's `transition: none` does under `prefers-reduced-motion`.
 *
 * There is no morph on mount. A blobatar eases out of idle only once a
 * consumer changes its expression, which is the web's rule too: transitions do
 * not run on an element's first style resolution, and a grid of avatars
 * animating themselves into existence on first paint is not what either
 * platform does.
 */
export function MorphingBlobatar(props: BlobatarProps) {
  return <Morphing {...split(props)} />;
}

/**
 * A blobatar with its idle layer running: breathe, bob, blink, glance, and the
 * tremor and seesaw two expressions carry. It morphs between expressions too,
 * so it is `MorphingBlobatar` with the ambient motion added rather than an
 * alternative to it.
 *
 * A third export rather than a prop, on the same measured grounds as the
 * second: the idle layer is the largest of the three tiers, and a prop on one
 * component is reachable from it whether or not anybody passes it. Three
 * components means an app pays for the tier it names.
 *
 * ## `animate` is the caller's, and that is the platform's doing
 *
 * On the web the idle layer is gated on `:hover`, which is both the aesthetic
 * answer and the performance one, and `animate="hover"` is the recommended
 * default for a grid. There is no hover on a touch screen. `motion.css` already
 * says so itself, under `@media not ((hover: hover) and (pointer: fine))`,
 * where it pauses every loop and forces amplitude to zero unless the blobatar
 * was marked `always`. So the only mode this platform has is the always one,
 * and the question of *when* becomes the app's rather than the library's.
 *
 * Which is the honest answer rather than a shortcut. Screen focus, list
 * viewability, a user preference, the OS reduced-motion setting: those are all
 * things an app knows and a component drawn into a scroll view does not.
 *
 * ```tsx
 * // a profile header, one large avatar
 * <AnimatedBlobatar name="ada" size={120} animate />
 *
 * // a grid: only what the list says is on screen
 * <AnimatedBlobatar name={u.id} size={44} animate={visible.has(u.id)} />
 *
 * // the OS setting, which this package cannot read itself
 * <AnimatedBlobatar name="ada" size={120} animate={!reduceMotion} />
 * ```
 *
 * It defaults to false, so an `AnimatedBlobatar` nobody has told to animate is
 * a still blobatar. Turning it on and off ramps the amplitude over 400ms rather
 * than switching it, which is `.mo-root`'s own transition: a blobatar that
 * begins breathing at full depth mid-breath reads as a fault.
 *
 * ## What runs it
 *
 * A `requestAnimationFrame` loop and a React render per frame, which is the
 * driver the morph already uses. Not Reanimated, and that was a decision with a
 * cost: worklets would run this on the UI thread, but a library has to ship
 * them pre-compiled, which means a Babel pass over a package built with Bun, a
 * peer dependency with a native build, and a copy of the composition inside the
 * worklet, since a worklet cannot call core's `idleTransforms`. That last one
 * is the thing ADR-0009 exists to prevent.
 *
 * The trade it leaves is real and worth knowing: every animating blobatar
 * re-renders sixty times a second on the JS thread. `animate` being the
 * caller's is what makes that affordable, because the app is the only thing
 * that knows how many need to be live at once.
 */
export function AnimatedBlobatar({
  animate = false,
  ...props
}: BlobatarProps & { animate?: boolean }) {
  return <Animated {...split(props as BlobatarProps)} on={animate} />;
}
