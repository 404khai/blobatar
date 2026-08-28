/**
 * The browser half of `scripts/probe-compose.ts`. Runs in headless Chrome and
 * writes its verdicts into `#r` as JSON.
 *
 * Everything checked here is checked here and nowhere else, because none of it
 * is visible to a test that only reads markup.
 *
 * **A — the two renderings of one pose agree.** The static path bakes the pose
 * into path data; the animated path composes it out of custom properties in
 * CSS. Nothing forced those to match, and they did not: `superellipse` bakes
 * rotation into coordinates, so a scale in CSS was squashing leaned eyes along
 * screen axes while the bake squashed them along the capsule's. This renders
 * both and compares where the pixels land.
 *
 * **B — an expression change does not rebuild the DOM.** The morph is a
 * transition, and a transition needs an element with a previous computed value.
 * If React replaces the subtree, the pose is simply born at its final value and
 * every idle animation under it restarts from phase zero. Checked with real
 * React, because the thing under test is React's reconciliation.
 *
 * **C — the morph is watchable, not merely present.** See `checkPacing`.
 *
 * **D — the tremor.** The one pose channel with no static counterpart, so A
 * cannot see it. See `checkShake`.
 *
 * **E — the two renderings of one colour agree.** A's argument, one axis over.
 * See `checkTint`.
 *
 * **F — the morph runs under a real page's conditions**, with the idle layers
 * live rather than frozen. See `checkLive`.
 *
 * **G — all three directions morph**, not just the way in. See
 * `checkDirections`.
 *
 * **H — a blink does not move a posed eye.** The one defect that lived in a
 * single frame of an ambient loop rather than in the pose. See `checkBlink`.
 *
 * **I — the seesaw.** The second channel A can only see one frame of, and the
 * first that is a *loop the bake agrees with* rather than one it cannot express.
 * See `checkRock`.
 *
 * **J — the gaze layer composes.** The first case that is about an entry point
 * rather than about the renderer: `blobatar/gaze` is a driver writing custom
 * properties and `blobatar/gaze.css` is a stylesheet turning them into a
 * transform, and neither half means anything without the other. See `checkGaze`.
 *
 * F and G exist because C's evidence was narrower than it read: it froze the
 * idle layers and only ever went `idle → happy`, which is one of three
 * mechanisms under conditions no real page has. Neither found a defect. That is
 * worth keeping anyway — "the morph doesn't run" was reported twice against a
 * library where it did, and being able to answer that in a minute with a
 * measurement is the point of this file.
 *
 * **Every new pose channel needs a case here.** A channel that only the CSS
 * applies, or only `bakePose` applies, looks completely fine in `bun test` — and
 * a channel with no static counterpart at all, like the tremor, is invisible to
 * every check that compares the two paths.
 */

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Blobatar } from "../../src/react";
import { happy, mad, thinking } from "../../src/expression";
import { gaze } from "../../src/gaze";

interface Eye {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

declare global {
  // eslint-disable-next-line no-var
  var CASES: {
    seed: string;
    name: string;
    lean: number;
    /** Serialized `blobatar()` output — the pose baked into path data. */
    static: string;
    /** The same blobatar animated: no pose in the markup, all of it in `vars`. */
    cls: string;
    inner: string;
    vars: Record<string, string>;
    /** `_layout` with the pose applied, and without. The animated markup draws
     *  the second and is supposed to *look* like the first. */
    posed: Eye[];
    base: Eye[];
    /** `[head, eye]` as the static path paints them, tint included. */
    fill: [string, string];
  }[];
}

type Result = { name: string; ok: boolean; detail: string; skip?: boolean };
const results: Result[] = [];
const report = (name: string, ok: boolean, detail: string, skip?: boolean) =>
  results.push({ name, ok, detail, skip });

/**
 * Whether `getScreenCTM()` on this engine reports CSS transforms in full.
 *
 * Gecko includes the linear part and drops the translation that
 * `transform-box: fill-box` implies — a `scaleX(2)` about a box's own centre
 * comes back as a scale about the user-space origin — while the *rendering* is
 * correct, and matches Blink's pixel for pixel. So the divergence check below
 * would read hundreds of pixels of disagreement in Firefox and be measuring the
 * measurement, which is exactly the mistake `outline()` was written to avoid one
 * level down.
 *
 * Probed rather than sniffed by user agent: this is a capability that will
 * change, and when it does the check should simply start running there.
 */
function ctmReportsTransforms() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.cssText = "position:absolute;left:0;top:0;width:100px;height:100px";
  svg.innerHTML =
    `<rect x="50" y="10" width="20" height="10"` +
    ` style="transform-box:fill-box;transform-origin:center;transform:scaleX(2)"/>`;
  document.body.appendChild(svg);
  const rect = svg.firstElementChild as SVGGraphicsElement;
  // The left edge doubles away from the box's own centre (60), so user x 50
  // must land on user x 40 — which is 40px on a 1:1 viewBox at the origin.
  const p = new DOMPoint(50, 10).matrixTransform(rect.getScreenCTM()!);
  svg.remove();
  return Math.abs(p.x - 40) < 0.5;
}

const SIZE = 400;
const frame = () => new Promise(requestAnimationFrame);

/** Off-screen, and frozen: at `--mo-amp: 0` every idle layer resolves to the
 *  identity, so what is left on screen is exactly the pose. */
function mount(html: string, vars?: Record<string, string>) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.cssText = `position:absolute;left:0;top:0;width:${SIZE}px;height:${SIZE}px`;
  for (const [k, v] of Object.entries(vars ?? {})) svg.style.setProperty(k, v);
  svg.innerHTML = html;
  svg.querySelector(".mo-root")?.classList.add("mo-frozen");
  document.body.appendChild(svg);
  return svg;
}

/** Petals are `<circle>`, so `path` finds the core first and the eyes last,
 *  whatever the silhouette. */
const paths = (svg: SVGSVGElement) => [
  ...svg.querySelectorAll<SVGPathElement>("g[fill] path"),
];

/**
 * Twelve points around one capsule's outline, in screen coordinates.
 *
 * Not `getBoundingClientRect`, and this matters: for SVG that returns the
 * axis-aligned box of the *transformed bounding box*, not a box around the
 * transformed geometry. The static path carries its rotation in its coordinates
 * and so reports a tight box; the animated one carries the same rotation as a
 * CSS transform and reports an inflated one. Comparing those two measures the
 * measurement, not the blobatar.
 *
 * So the capsule is evaluated where it is defined — its own `cx/cy/rx/ry/rot`,
 * which is the layout the renderer drew from — and each point is pushed through
 * the element's own `getScreenCTM()`. That CTM carries every transform the CSS
 * composed onto it, which is exactly the thing under test.
 */
function outline(el: SVGGraphicsElement, e: Eye) {
  const m = el.getScreenCTM()!;
  const t = (e.rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    const x = e.rx * Math.cos(a);
    const y = e.ry * Math.sin(a);
    return new DOMPoint(
      e.cx + x * c - y * s,
      e.cy + x * s + y * c,
    ).matrixTransform(m);
  });
}

async function checkGeometry() {
  if (!ctmReportsTransforms()) {
    report(
      "A static bake and CSS composition agree",
      true,
      "not measurable in this engine — getScreenCTM() omits the translation" +
        " that transform-box: fill-box implies, so every posed eye would read" +
        " as hundreds of pixels out while rendering correctly. Run the gate in" +
        " Chrome for this one; the pose was verified against the bake by" +
        " screenshot here.",
      true,
    );
    return;
  }
  let worst = 0;
  let worstCase = "";
  /** Per-pose, per-part maxima — a divergence that shows up under `idle` is a
   *  different bug from one that only shows up under a pose. */
  const byPose: Record<string, number[]> = {};

  for (const c of globalThis.CASES) {
    const a = mount(c.static);
    const b = mount(`<g class="${c.cls}">${c.inner}</g>`, c.vars);
    await frame();

    const pa = paths(a);
    const pb = paths(b);
    const row = (byPose[c.name] ??= [0, 0, 0]);

    // The body carries no rotation of its own on either path, so its rect is
    // measured the same way on both sides and is a fair comparison — and it is
    // the only thing that catches a body channel composing about the wrong
    // origin.
    const bodyA = pa[0]!.getBoundingClientRect();
    const bodyB = pb[0]!.getBoundingClientRect();
    const dBody = Math.max(
      Math.abs(bodyA.left - bodyB.left),
      Math.abs(bodyA.top - bodyB.top),
      Math.abs(bodyA.width - bodyB.width),
      Math.abs(bodyA.height - bodyB.height),
    );
    row[0] = Math.max(row[0]!, dBody);

    for (let i = 0; i < 2; i++) {
      const sa = outline(pa.slice(-2)[i]!, c.posed[i]!);
      const sb = outline(pb.slice(-2)[i]!, c.base[i]!);
      // In CSS pixels at 4× the viewBox, so a pixel of drift is a quarter of a
      // viewBox unit.
      const d = Math.max(
        ...sa.map((p, k) => Math.hypot(p.x - sb[k]!.x, p.y - sb[k]!.y)),
      );
      row[i + 1] = Math.max(row[i + 1]!, d);
      if (d > worst) {
        worst = d;
        worstCase = `${c.name} on ${c.seed} (lean ${c.lean.toFixed(1)}°), eye ${i}`;
      }
    }
    if (dBody > worst) {
      worst = dBody;
      worstCase = `${c.name} on ${c.seed}, body`;
    }
    a.remove();
    b.remove();
  }

  // The two agree to about 0.01px in practice, so this is a floating-point
  // tolerance and not a budget: 0.25px at 400px is 1/16 of a viewBox unit,
  // under the two-decimal rounding the path serializer already applies. A
  // screen-axis squash on a leaned eye lands 25px out, so there is no band
  // between "correct" and "the bug is back".
  report(
    "A static bake and CSS composition agree",
    worst < 0.25,
    `worst divergence ${worst.toFixed(2)}px of ${SIZE} — ${worstCase}\n  ` +
      Object.entries(byPose)
        .map(
          ([k, v]) =>
            `${k}: body ${v[0]!.toFixed(2)} / eyes ${v[1]!.toFixed(2)}, ${v[2]!.toFixed(2)}`,
        )
        .join("\n  "),
  );
}

async function checkContinuity() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={200} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const svg0 = host.querySelector("svg")!;
  const root0 = host.querySelector(".mo-root")!;
  const eye = host.querySelector(".mo-eye")!;
  const breathe = host.querySelector(".mo-breathe")!;
  const anim = breathe.getAnimations()[0]!;
  // Awaited, not assumed. A newly-created animation reports `startTime: null`
  // until it is ready, which Chrome resolves on a later frame — so under load
  // this captured a null, compared it against a real number afterwards, and
  // reported the seeded phase offset as lost. Order-dependent and entirely
  // spurious: it failed when other checks ran first and passed when they did
  // not, which is the signature of a flake rather than a defect.
  await anim.ready;
  const before = anim.startTime;

  // What React actually does to the DOM, rather than what it was supposed to.
  // An expression change should be attribute writes and nothing else: the class
  // on the root, and the pose properties in the `<svg>`'s style.
  const attrs: string[] = [];
  const structural: string[] = [];
  new MutationObserver((rs) => {
    for (const r of rs)
      (r.type === "attributes" ? attrs : structural).push(
        r.type === "attributes"
          ? `${r.attributeName} on <${(r.target as Element).tagName}>`
          : `${(r.target as Element).tagName} children ` +
            `(+${r.addedNodes.length}/-${r.removedNodes.length})`,
      );
  }).observe(host, { attributes: true, childList: true, subtree: true });

  setExpr(happy);
  await frame();
  await frame();

  report(
    "B nothing is added or removed, only written to",
    structural.length === 0,
    structural.length
      ? structural.join(", ")
      : `${attrs.length} attribute writes: ${[...new Set(attrs)].join(", ")}`,
  );

  const sameEye = host.querySelector(".mo-eye") === eye;
  const sameBreathe = host.querySelector(".mo-breathe") === breathe;
  report(
    "B the DOM survives an expression change",
    sameEye && sameBreathe && eye.isConnected,
    sameEye && sameBreathe
      ? "eye and breathe nodes are the same objects after the change"
      : `React replaced the subtree — the morph cannot run on a new element` +
        ` (svg ${host.querySelector("svg") === svg0}, root ${
          host.querySelector(".mo-root") === root0
        }, breathe ${sameBreathe}, eye ${sameEye})`,
  );

  // The seeded negative delay is what stops a grid breathing in unison, and a
  // restarted animation throws it away — every reacting blobatar snaps into phase
  // with every other one. Both halves are checked: the same `Animation` object,
  // and a `startTime` that did not move. A restart gives a new object; a
  // silently rescheduled one gives a new start.
  const after = host.querySelector(".mo-breathe")!.getAnimations()[0]!;
  report(
    "B breathe is not restarted",
    after === anim && after.startTime === before,
    after === anim && after.startTime === before
      ? `same Animation, startTime held at ${Math.round(Number(before))}ms,` +
        ` now ${Math.round(Number(after.currentTime))}ms into its loop`
      : "the animation was re-created — the seeded phase offset is gone",
  );

  report(
    "B the root class carries the expression",
    host.querySelector(".mo-root")!.classList.contains("mo-expr"),
    // `.mo-root` is an SVG `<g>`, so `className` is an `SVGAnimatedString`.
    // `querySelector` only promises an `Element`, whose `className` is a string.
    (host.querySelector(".mo-root") as SVGElement).className.baseVal,
  );

  // The morph itself: a transition must be running on the pose properties.
  const running = host
    .querySelector(".mo-root")!
    .getAnimations()
    .filter((a) => a instanceof CSSTransition)
    .map((a) => (a as CSSTransition).transitionProperty);
  report(
    "B a transition is actually running on the pose",
    running.some((p) => p.startsWith("--mo-")),
    running.length ? running.join(", ") : "no transitions on .mo-root",
  );
}

/**
 * C — the morph is *watchable*, not merely present.
 *
 * "A transition exists" and "you can see a transition" are different claims,
 * and the gap between them is where this shipped its second bug. The pose
 * channels travel wildly different distances — `bsx` moves 4%, `esy` moves 40%
 * — so a curve that reads as a gentle settle on the body can be entirely over
 * on the eyes before they appear to have left. That is what a hard ease-out
 * did: 53% of the eye's travel in three frames, 87% inside 100ms, then 140ms of
 * invisible tail. The transition was running the whole time and the eyes read
 * as a hard swap.
 *
 * So this measures the eye, not the body — the channel with the most to travel
 * is the one that exposes the curve — and it measures the *shape* of the
 * movement rather than its existence.
 */
async function checkPacing() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  // Frozen, so the only thing moving is the morph. Blink alone closes the eye
  // to 8% of its height for ~100ms at a time; sampling through one would report
  // the ambient loop as morph progress and make this check both wrong and
  // intermittent.
  const root = host.querySelector(".mo-root")!;
  root.classList.add("mo-frozen");
  const eye = host.querySelector<SVGPathElement>(".mo-eye")!;
  const h = () => eye.getBoundingClientRect().height;
  const from = h();

  // Read out of the stylesheet rather than hard-coded, so this measures the
  // *shape* of the curve at whatever duration is set. Duration is a taste dial
  // and the gate should not own it; front-loading and dead starts are defects
  // and it should. Pinning 240ms here is why raising the duration for the
  // exaggeration pass would otherwise have failed a check that had no opinion
  // about duration at all.
  //
  // Taken off `transition-duration` rather than off `--mo-morph`, which is an
  // *unregistered* custom property and therefore reads back as the raw token
  // stream `calc(420ms * var(--mo-rate, 1))` — `parseFloat` of that is NaN, and
  // a NaN duration silently walks this whole check off the end of its trace.
  // The resolved list is also the more honest source: it is the duration the
  // engine is actually using. Index 2 is the first pose channel, after
  // `--mo-amp` and `transform`.
  root.classList.add("mo-expr");
  const DUR =
    parseFloat(getComputedStyle(root).transitionDuration.split(",")[2]!) * 1000;
  root.classList.remove("mo-expr");

  const t0 = performance.now();
  const trace: [number, number][] = [[0, from]];
  setExpr(happy);
  // A third past the end, so the settle can be seen ending rather than assumed.
  while (performance.now() - t0 < DUR * 1.35) {
    await frame();
    trace.push([performance.now() - t0, h()]);
  }
  const to = trace[trace.length - 1]![1];
  const travel = Math.abs(from - to);
  /**
   * Fraction of the travel completed at `ms`, interpolated between the frames
   * either side of it. Frames land every ~16ms and never on the marks being
   * asked about; snapping to the next one instead reports up to a frame of
   * extra progress, which at the front of a fast curve is the difference
   * between 26% and 42%.
   */
  const at = (ms: number) => {
    const i = trace.findIndex(([t]) => t >= ms);
    const [t1, v1] = trace[i]!;
    const [t0_, v0] = trace[i - 1] ?? trace[i]!;
    const k = t1 === t0_ ? 0 : (ms - t0_) / (t1 - t0_);
    return Math.abs(from - (v0 + (v1 - v0) * k)) / travel;
  };

  report(
    "C the eye morph is watchable, not a cut",
    // Enough real travel to be judging something at all, then two bounds on the
    // shape, both stated as fractions of the duration rather than in
    // milliseconds.
    //
    // At a fifth of the way through: more than 4% or the curve has a dead start
    // and a triggered expression feels late; less than 35% or it is front-loaded
    // and the eye is gone before it appears to have left, which is
    // indistinguishable from no transition. At the halfway mark: between a third
    // and three quarters, which is what catches the long invisible tail — a
    // curve can pass the first bound and still dump everything into the middle.
    travel > 10 &&
      at(DUR * 0.2) > 0.04 &&
      at(DUR * 0.2) < 0.35 &&
      at(DUR * 0.5) > 0.33 &&
      at(DUR * 0.5) < 0.75,
    `eye height ${from.toFixed(1)}px → ${to.toFixed(1)}px over ${trace.length}` +
      ` frames of a ${DUR.toFixed(0)}ms morph; travel at each fifth: ` +
      [0.2, 0.4, 0.6, 0.8, 1]
        .map((f) => `${(at(DUR * f) * 100).toFixed(0)}%`)
        .join(" ") +
      `\n  ` +
      trace
        .slice(0, 8)
        .map(([t, v]) => `${t.toFixed(0)}:${v.toFixed(1)}`)
        .join(" "),
  );

  // The other half of "watchable": distinct rendered values, so the change is
  // spread over frames rather than landing in one.
  const steps = new Set(trace.map(([, v]) => v.toFixed(1))).size;
  report(
    "C the change is spread across frames",
    steps > 10,
    `${steps} distinct rendered eye heights across the morph`,
  );
}

/**
 * D — the tremor is real, and only where it was asked for.
 *
 * A shake is the one pose channel with no static counterpart, so check A cannot
 * see it: a bake is a still frame and a tremor is a loop, and A freezes it for
 * exactly that reason. Which leaves it completely unguarded — a `--mo-shake`
 * that never reached `translate`, or a keyframe that failed to resolve to the
 * identity at amplitude zero and left every blobatar in the grid quivering, would
 * both pass every other check in this file.
 *
 * So both halves are measured, on the same element, in screen coordinates: the
 * angry blobatar moves, and the happy one does not move at all.
 */
async function checkShake() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  createRoot(host).render(
    <>
      <Blobatar name="alain00" animate="always" expression={mad} size={SIZE} />
      <Blobatar name="alain00" animate="always" expression={happy} size={SIZE} />
    </>,
  );
  await frame();
  await frame();

  // Amplitude pinned so the idle layers contribute nothing; the tremor is not
  // gated on `--mo-amp`, because an expression has to survive an unhovered grid.
  const roots = [...host.querySelectorAll<SVGGElement>(".mo-root")];
  for (const r of roots) r.classList.add("mo-frozen-amp");

  // Sampled over more than one full period (112ms) so a slow frame cannot land
  // on the same phase twice and report a stationary blobatar.
  const travel = async (el: SVGGElement) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 16; i++) {
      await frame();
      const m = el.getScreenCTM()!;
      xs.push(m.e);
      ys.push(m.f);
    }
    return Math.hypot(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
  };

  const angry = await travel(roots[0]!);
  const calm = await travel(roots[1]!);

  report(
    "D the tremor moves an angry blobatar and nothing else",
    angry > 1 && calm < 0.01,
    `mad travels ${angry.toFixed(2)}px of ${SIZE}, happy ${calm.toFixed(3)}px`,
  );
}

/**
 * E — the two renderings of one *colour* agree.
 *
 * Check A's argument, one axis over. A hot pose resolves its tint twice: into
 * `fill` attributes on the static path, and into `--mo-head`/`--mo-eye` for the
 * stylesheet on the animated one. Nothing forces those to match, and a rule that
 * silently loses — a specificity slip, a `var()` with nothing behind it making
 * `fill` inherit black — looks completely fine to `bun test`, which only ever
 * sees the string.
 */
async function checkTint() {
  const rgb = (s: string) =>
    s.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
      : s.match(/\d+/g)!.slice(0, 3).map(Number);

  let worst = 0;
  let worstCase = "";
  for (const c of globalThis.CASES) {
    const b = mount(`<g class="${c.cls}">${c.inner}</g>`, c.vars);
    await frame();
    const groups = [
      b.querySelector<SVGGElement>(".mo-bob > g:not(.mo-eyes)")!,
      b.querySelector<SVGGElement>(".mo-eyes")!,
    ];
    groups.forEach((g, i) => {
      const got = rgb(getComputedStyle(g).fill);
      const want = rgb(c.fill[i]!);
      const d = Math.max(...got.map((v, k) => Math.abs(v - want[k]!)));
      if (d > worst) {
        worst = d;
        worstCase =
          `${c.name} on ${c.seed}, ${i ? "eyes" : "body"} — ` +
          `static ${c.fill[i]}, animated ${getComputedStyle(g).fill}`;
      }
    });
    b.remove();
  }

  // Exact, in 8-bit channels. Both sides start from the same hex string, so
  // there is no rounding to allow for and any drift at all is a real defect.
  report(
    "E static and animated agree on colour, tint included",
    worst === 0,
    worst === 0
      ? "every pose, both groups, byte-identical channels"
      : `off by ${worst}/255 — ${worstCase}`,
  );
}

/**
 * F — the morph runs under the conditions a real page has, not the lab's.
 *
 * Every other check that watches the morph freezes `--mo-amp` first, so that the
 * only thing moving is the transition. That is right for measuring the curve and
 * wrong as the *only* evidence the curve runs: a live blobatar has five idle
 * animations going, and two of them — `mo-blink` and `mo-wrap` — write the very
 * properties the pose composes into. "It interpolates when nothing else is
 * touching it" is a weaker claim than it sounds.
 *
 * Instrumented on the registered custom property rather than on geometry,
 * which is what makes this measurable at all with the idle layers live: blink
 * closes the eye to 8% of its height for ~100ms at a time, so a geometric sample
 * cannot tell a morph from a blink. `--mo-esy` is a `<number>` nothing but the
 * transition writes.
 *
 * Mirrors the site's hero exactly — `animate="always"`, a `title`, a CSS-sized
 * SVG — because that is the surface the claim is about.
 */
async function checkLive() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return (
      <Blobatar
        name="alain00"
        animate="always"
        expression={e}
        title="Blobatar for alain00"
        style={{ width: SIZE, height: SIZE }}
      />
    );
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const root = host.querySelector(".mo-root")!;
  const esy = () =>
    parseFloat(getComputedStyle(root).getPropertyValue("--mo-esy"));
  // Read with `mo-expr` on, or this reports the *return* duration — the base
  // rule's — and calls it the morph in.
  root.classList.add("mo-expr");
  const DUR =
    parseFloat(getComputedStyle(root).transitionDuration.split(",")[2]!) * 1000;
  root.classList.remove("mo-expr");

  // Rendered *width*, not height, and that is the whole trick to measuring this
  // live. `esx` travels 1 → 1.72 and no idle layer touches X by more than the
  // wrap layer's 7%, while blink closes the eye to 8% of its height for ~100ms
  // at a time — so height cannot distinguish a morph from a blink and width can.
  const eye = host.querySelector<SVGPathElement>(".mo-eye")!;
  const w = () => eye.getBoundingClientRect().width;

  const t0 = performance.now();
  const prop: number[] = [esy()];
  const geom: number[] = [w()];
  setExpr(happy);
  while (performance.now() - t0 < DUR * 1.3) {
    await frame();
    prop.push(esy());
    geom.push(w());
  }

  const propSteps = new Set(prop.map((v) => v.toFixed(4))).size;
  // Quantised to a tenth of a pixel, so a genuinely stepped render cannot pass
  // on sub-pixel jitter from the wrap layer.
  const geomSteps = new Set(geom.map((v) => v.toFixed(1))).size;

  report(
    "F the morph runs with the idle layers live, not only frozen",
    propSteps > 10 && geomSteps > 10,
    propSteps > 10 && geomSteps > 10
      ? `${propSteps} values of --mo-esy and ${geomSteps} rendered eye widths` +
        ` across a ${DUR.toFixed(0)}ms morph` +
        ` (${geom[0]!.toFixed(1)}px → ${geom[geom.length - 1]!.toFixed(1)}px)`
      : propSteps <= 10
        ? `--mo-esy took ${propSteps} value(s) — the pose is not transitioning:` +
          ` ${[...new Set(prop.map((v) => v.toFixed(3)))].slice(0, 6).join(" ")}`
        : // The interesting failure, and the reason this check samples both: the
          // property interpolated and the shape did not. The eye's scale lives
          // inside `@keyframes mo-blink`, so that would mean a running animation
          // is not re-resolving its `var()` substitutions as the pose moves —
          // the eyes would snap while `bdy` eased.
          `--mo-esy interpolated over ${propSteps} values but the eye rendered` +
          ` only ${geomSteps} width(s): the keyframe is not following the pose`,
  );
}

/**
 * G — the other two directions.
 *
 * Everything above measures `idle → happy` and nothing else, which quietly
 * leaves two thirds of the feature untested. The three transitions are not the
 * same mechanism:
 *
 *  - **Into an expression** the renderer *adds* declarations, and the transition
 *    runs from the registered `initial-value` to them.
 *  - **Back to idle** it *removes* them, and the transition has to run toward
 *    those initials. That is the half `idle` being free depends on — an omitted
 *    declaration *is* the identity — and nothing had ever watched it happen.
 *  - **Between two expressions** it rewrites them, retargeting from whatever the
 *    current computed value happens to be, possibly mid-flight.
 *
 * Sampled on `--mo-esx`, whose three poses are far apart (1 / 1.72 / 1.85) so
 * every leg has real travel to show.
 */
async function checkDirections() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const root = host.querySelector(".mo-root")!;
  const esx = () =>
    parseFloat(getComputedStyle(root).getPropertyValue("--mo-esx"));

  /** Drives one leg and returns how many distinct values it passed through. */
  const leg = async (to: typeof happy | undefined, ms: number) => {
    const seen: number[] = [esx()];
    const t0 = performance.now();
    setExpr(to);
    while (performance.now() - t0 < ms) {
      await frame();
      seen.push(esx());
    }
    return {
      steps: new Set(seen.map((v) => v.toFixed(4))).size,
      from: seen[0]!,
      to: seen[seen.length - 1]!,
    };
  };

  // Settle fully between legs, so each one starts from a resting value rather
  // than from the tail of the last.
  const enter = await leg(happy, 700);
  const swap = await leg(mad, 700);
  const back = await leg(undefined, 900);

  const rows = [
    ["idle→happy", enter],
    ["happy→mad", swap],
    ["mad→idle", back],
  ] as const;

  report(
    "G every direction morphs, not just the way in",
    rows.every(([, r]) => r.steps > 10),
    rows
      .map(
        ([name, r]) =>
          `${name} ${r.from.toFixed(2)}→${r.to.toFixed(2)} in ${r.steps} steps`,
      )
      .join(", "),
  );
}

/**
 * H — a blink does not move a posed eye.
 *
 * The bug this exists for: the eye wrapper took its `transform-origin` from
 * `fill-box`, a `<g>`'s fill box is its children's *rendered* geometry, and
 * Gecko recomputes it as the shape inside shrinks. Every blink therefore moved
 * the wrapper's origin, the pose's anisotropic scale multiplied that shift, and
 * the eye travelled ~30 viewBox units out and back — on `mad`, out of the frame
 * entirely. Reported as "the transition back to idle blinks", because an idle
 * wrapper's transform is the identity and an identity does not care where its
 * origin is: the artifact existed only while an expression was on.
 *
 * Nothing else here could see it. A and E compare the two renderings *at rest*,
 * and at rest the pose is correct in both engines; C, F and G sample the morph's
 * own channels, which never misbehaved. It took a frame inside a blink.
 *
 * Measured by hit-testing rather than by any box API. `getBoundingClientRect()`
 * and `getScreenCTM()` each disagree with the other engine about transformed SVG
 * — that is why check A skips in Blink — and this check has to be trusted in
 * Gecko above all, since that is where the defect lived. Hit-testing runs
 * against the geometry the engine paints, which is the thing under test.
 */
async function checkBlink() {
  /** The painted box of one shape, from `elementFromPoint` hits alone. */
  const painted = (el: Element, box: DOMRect) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let y = box.top; y < box.bottom; y += 2)
      for (let x = box.left; x < box.right; x += 2) {
        if (document.elementFromPoint(x, y) !== el) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    return x1 < x0 ? null : { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, h: y1 - y0 };
  };

  const rows: [string, number, number][] = [];
  // One blobatar at a time, at the top-left. Three side by side is 1200px of a
  // headless window that is 800 wide in one engine and wider in another, and
  // `elementFromPoint` outside the viewport simply returns null — which reads
  // as "the eye is nowhere" and would fail this check for the wrong reason.
  for (const [name, e] of [
    ["idle", undefined],
    ["happy", happy],
    ["mad", mad],
  ] as [string, typeof happy | undefined][]) {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:0;top:0";
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />,
    );
    await frame();
    await frame();
    /*
   * The driver declines to attach without a real pointer, which is the correct
   * behaviour and makes this check unrunnable in an engine that cannot be told
   * it has one. Chrome is launched with Blink's pointer and hover settings for
   * exactly this; Firefox has no equivalent switch, so it reports what headless
   * actually is and this skips rather than failing. The composition it measures
   * is not engine-specific, and the alternative — bypassing the guard from the
   * test — would be asserting against a code path no browser ever runs.
   */
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) {
    report(
      "J the gaze follows a pointer as a mark on a sphere, and moves only the eyes",
      true,
      "not measurable in this engine — it reports no fine pointer, so the driver " +
        "correctly declines to attach. Run the gate in Chrome for this one.",
      true,
    );
    host.remove();
    return;
  }

  const svg = host.querySelector("svg")!;
    const shape = svg.querySelector(".mo-eye > *")!;
    const anims = svg.getAnimations({ subtree: true });
    for (const a of anims) a.pause();
    const blink = anims.find(
      (a) => (a as CSSAnimation).animationName === "mo-blink",
    )!;
    const dur = blink.effect!.getComputedTiming().duration as number;

    // `animation-delay` carries the seeded phase and is negative, so
    // `currentTime` is not iteration progress — solve for the offset rather
    // than assume it, or this parks the blink at an arbitrary moment and
    // measures nothing.
    const at = async (target: number) => {
      blink.currentTime = 0;
      const p0 = (blink.effect!.getComputedTiming().progress as number) ?? 0;
      blink.currentTime = ((((target - p0) % 1) + 1) % 1) * dur;
      await frame();
      await frame();
      return painted(shape, svg.getBoundingClientRect());
    };

    const rest = await at(0.5);
    const shut = await at(0.986);
    for (const a of anims) a.play();
    rows.push(
      rest && shut
        ? [name, Math.hypot(shut.cx - rest.cx, shut.cy - rest.cy), rest.h - shut.h]
        : [name, Infinity, 0],
    );
    root.unmount();
    host.remove();
  }

  report(
    "H a blink closes the eye without moving it, under every pose",
    // Two hit-test grid steps of slack, and no more: the failure this guards
    // was 111px on `happy` and 128px on `mad` of a 400px blobatar.
    rows.every(([, moved, closed]) => moved <= 4 && closed > 4),
    rows
      .map(
        ([n, moved, closed]) =>
          `${n} centre ${moved.toFixed(1)}px, height −${closed.toFixed(1)}px`,
      )
      .join("; ") + ` of ${SIZE}`,
  );
}

/**
 * I — the seesaw trades the eyes' heights, and only on the pose that asked.
 *
 * Check A sees exactly one frame of this: the phase is pinned to 1 there, where
 * the composition has to equal the bake. That is the identity worth pinning and
 * it says nothing at all about the other 95% of the cycle — a `--mo-rock` that
 * never reached `translate`, a keyframe stuck at one value, or a phase that
 * moved both eyes the same way instead of opposite ways would all pass A, and
 * two of the three would pass by rendering a completely static face.
 *
 * So all three claims are measured on screen: the eyes move, they move in
 * *opposite* directions, and their midpoint does not move at all — the last one
 * being the difference between a seesaw and a second `mo-bob` beating against
 * the first. The fourth claim is the one every amplitude channel here needs: a
 * pose that does not rock does not move a pixel.
 *
 * Amplitude is pinned rather than the animations stopped, for `checkShake`'s
 * reason: the seesaw is not gated on `--mo-amp`, deliberately, so pinning it to
 * zero silences every ambient layer and leaves this one running alone.
 */
async function checkRock() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  createRoot(host).render(
    <>
      <Blobatar name="alain00" animate="always" expression={thinking} size={SIZE} />
      <Blobatar name="alain00" animate="always" expression={happy} size={SIZE} />
    </>,
  );
  await frame();
  await frame();

  const roots = [...host.querySelectorAll<SVGGElement>(".mo-root")];
  for (const r of roots) r.classList.add("mo-frozen-amp");

  // Pinning the amplitude is a *transition*, 400ms of it, and the saccade rides
  // it down on `.mo-eyes` — an ancestor of both eyes, so it moves the midpoint
  // this check is asserting does not move. Measured against an unsettled ramp
  // that reads as 2.3px of drift in Blink and 0 in Gecko, which is the endpoint
  // substitution documented on `.mo-eye` making Firefox look correct for the
  // wrong reason. Wait it out rather than raise the tolerance: the tolerance is
  // the whole assertion.
  for (let i = 0; i < 45; i++) await frame();

  // Sampled across most of the 900ms period, so the window cannot land inside a
  // single direction of travel and read a seesaw as a drift.
  const SAMPLES = 48;

  const track = async (root: SVGGElement) => {
    const eyes = [...root.querySelectorAll<SVGGElement>(".mo-eye")];
    const ys: number[][] = [[], []];
    /*
     * A frame the engine has not laid out yields `null` from `getScreenCTM()`,
     * and Gecko does that for a frame or two mid-sample on a loaded runner. The
     * `!` that used to be here is a TypeScript assertion with no runtime effect,
     * so one null threw a bare TypeError, and because the runner wrapped every
     * check in one `try`, it also took the eight checks after this one down
     * unrun and unreported. CI showed `harness` and a line number in a bundle.
     *
     * A dropped sample is the same class of thing the step-based anticorrelation
     * below already tolerates: the seesaw runs a 900ms period against a ~16ms
     * frame, so a gap lengthens one step rather than inverting it. So nulls are
     * skipped and counted rather than retried in place.
     *
     * Bounded at twice the sample count so an engine that never lays the eyes
     * out ends the loop instead of spinning, and reports a short sample as a
     * failed check. That path also covers a root with no `.mo-eye` under it,
     * where nothing would ever be pushed.
     */
    let missed = 0;
    for (let i = 0; i < SAMPLES * 2 && ys[0]!.length < SAMPLES; i++) {
      await frame();
      const ms = eyes.map((e) => e.getScreenCTM());
      if (eyes.length !== 2 || ms.some((m) => !m)) {
        missed++;
        continue;
      }
      ms.forEach((m, k) => ys[k]!.push(m!.f));
    }
    // Guarded against an empty sample so a short run reports zeroes next to its
    // `SHORT SAMPLE` note rather than `-Infinity`. Reading a zero as a pass is
    // not possible: `enough` below gates the whole assertion on the count.
    const span = (v: number[]) => (v.length ? Math.max(...v) - Math.min(...v) : 0);
    const [l, r] = ys as [number[], number[]];
    const mid = l.map((v, i) => (v + r[i]!) / 2);
    // Anticorrelation, measured on the steps rather than on the values, so a
    // slow frame shortens a step instead of inverting one.
    let dot = 0;
    for (let i = 1; i < l.length; i++) dot += (l[i]! - l[i - 1]!) * (r[i]! - r[i - 1]!);
    return { travel: Math.min(span(l), span(r)), drift: span(mid), dot, missed, n: l.length };
  };

  const busy = await track(roots[0]!);
  const calm = await track(roots[1]!);

  // A short sample is a failure and not a silent pass. Reading a seesaw from
  // half a period is exactly how this check would go green while measuring
  // nothing, which is worse than the throw it replaces.
  const enough = busy.n === SAMPLES && calm.n === SAMPLES;
  const dropped = busy.missed + calm.missed;

  report(
    "I the seesaw trades the eyes' heights and moves nothing else",
    enough && busy.travel > 1 && busy.dot < 0 && busy.drift < 0.5 && calm.travel < 0.01,
    `thinking: each eye travels ${busy.travel.toFixed(1)}px of ${SIZE}, ` +
      `midpoint ${busy.drift.toFixed(3)}px, steps anticorrelated (${busy.dot.toFixed(1)}); ` +
      `happy ${calm.travel.toFixed(3)}px` +
      (dropped ? `; ${dropped} unlaid frames skipped` : "") +
      (enough ? "" : `; SHORT SAMPLE ${busy.n}/${SAMPLES} and ${calm.n}/${SAMPLES}`),
  );
}


/**
 * J — the gaze layer composes: a pointer moves the eyes, and only the eyes.
 *
 * The one check that covers `blobatar/gaze`, and it has to be here rather than
 * in `bun test` for the same reason every other case is: the layer is a driver
 * writing custom properties and a stylesheet turning them into a transform, and
 * neither half means anything without the other. A unit test can prove `step`
 * returns the right numbers and would go on passing if the stylesheet read a
 * property nobody writes, or if the driver wrote to an element the rule cannot
 * see from. That second failure is not hypothetical: `--mo-track-hold` has to
 * be written *above* `.mo-root` to reach the rule that damps the idle rove, and
 * writing it to `.mo-eyes` alongside the excursion looks entirely correct in
 * the source.
 *
 * Four claims, in one pass over one blobatar:
 *
 *  1. The eyes follow. A pointer to the right moves them right, on screen, in
 *     the geometry the stylesheet decides rather than in the driver's units.
 *  2. The excursion is bounded by `--mo-track-travel`. A direction is a unit
 *     vector, so the eyes may not travel further than the excursion the page
 *     set, whatever the pointer does.
 *  3. The body does not move. `motion.css` reserves `.mo-eyes`'s `transform`
 *     for this layer alone, and a gaze that dragged the silhouette with it
 *     would mean the rule had landed on the wrong group.
 *  4. The idle rove stands down. `--mo-track-hold` reaches `.mo-root` and damps
 *     `--mo-look-x`, which is the claim the nesting can silently break.
 *
 * Unfrozen, deliberately. Every other check pins `--mo-amp` to take the idle
 * layers out of the measurement; this one is *about* the gaze composing with
 * them, so the saccade and the blink run underneath exactly as they do on a
 * page, and claim 3 is measured against that noise rather than against a still.
 */
async function checkGaze() {
  const host = document.createElement("div");
  /* Positioned, so the blobatar's client rect is somewhere predictable and the
     synthetic pointer below can be aimed relative to it. */
  host.style.cssText = "position:fixed;left:0;top:0";
  document.body.appendChild(host);
  createRoot(host).render(<Blobatar name="alain00" animate="always" size={SIZE} />);
  await frame();
  await frame();

  /*
   * The driver declines to attach without a real pointer, which is the correct
   * behaviour and makes this check unrunnable in an engine that cannot be told
   * it has one. Chrome is launched with Blink's pointer and hover settings for
   * exactly this; Firefox has no equivalent switch, so it reports what headless
   * actually is and this skips rather than failing. The composition it measures
   * is not engine-specific, and the alternative — bypassing the guard from the
   * test — would be asserting against a code path no browser ever runs.
   */
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) {
    report(
      "J the gaze follows a pointer as a mark on a sphere, and moves only the eyes",
      true,
      "not measurable in this engine — it reports no fine pointer, so the driver " +
        "correctly declines to attach. Run the gate in Chrome for this one.",
      true,
    );
    host.remove();
    return;
  }

  const svg = host.querySelector("svg")!;
  const eyes = host.querySelector(".mo-eyes")! as SVGGElement;
  const body = host.querySelector(".mo-bob")! as SVGGElement;
  /*
   * The gaze lands on each eye, not on the group, so the group is no longer
   * where the excursion can be read. §4.5 is a projection: the two eyes sit at
   * different longitudes and move by different amounts, which is the whole cue,
   * and a translate on the pair could not express it. `.mo-eyes` is still what
   * the *rove* moves — that stays a translate on the group — so both elements
   * are measured here, each for the layer that actually uses it.
   */
  const eye = host.querySelectorAll(".mo-eye")[1] as SVGGElement;

  /* The excursion the page sets. `gaze.css` registers it at 0, so without this
     the whole layer is the identity — which is the safety property, and also
     what would make this check pass while measuring nothing. */
  const TRAVEL = 3;
  eyes.style.setProperty("--mo-track-travel", `${TRAVEL}px`);

  /* A viewBox unit is `SIZE / 100` CSS pixels, so this is the excursion in the
     space `getScreenCTM` reports. */
  const perUnit = SIZE / 100;

  /**
   * How far the idle rove is moving the eye group right now.
   *
   * Read off `translate`, which is the property `mo-saccade` animates and the
   * one `motion.css` keeps the rove on precisely so that the gaze can have
   * `transform`. Measured rather than read out of `--mo-look-x`, because that
   * channel is unregistered: its computed value is the token stream
   * `calc(1.4 * (1 - 0))` rather than a number, so a test that parsed it would
   * be asserting against a string. What the stand-down is *for* is this
   * movement stopping, so this is the thing to measure.
   */
  const roveOver = async (frames: number) => {
    const seen: number[] = [];
    for (let i = 0; i < frames; i++) {
      await frame();
      const t = getComputedStyle(host.querySelector(".mo-eyes")!).translate;
      seen.push(parseFloat(t) || 0);
    }
    return Math.max(...seen) - Math.min(...seen);
  };

  /* The rove before anything stands it down. A saccade holds for most of its
     cycle and jumps in ~1.5% windows, so this samples long enough to catch at
     least one jump at the seeded period. */
  const roving = await roveOver(200);

  const g = gaze(svg);

  const point = async (x: number, y: number, frames = 40) => {
    dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }));
    for (let i = 0; i < frames; i++) await frame();
  };

  /** The eye's rest centre in its own user space, for pushing through the CTM. */
  const rest = (() => {
    const g = eye.getBBox();
    return new DOMPoint(g.x + g.width / 2, g.y + g.height / 2);
  })();

  /**
   * Where the eye's centre is, in screen pixels, and where the body is.
   *
   * A point through the CTM rather than the matrix's own translation, for the
   * reason `outline()` above gives at length: `.mo-eye` scales about its own
   * centre, and a scale about anything but the origin puts translation into the
   * matrix. Reading `e` would be reading the foreshortening as movement.
   */
  const at = () => {
    const p = rest.matrixTransform(eye.getScreenCTM()!);
    const b = body.getScreenCTM()!;
    return { ex: p.x, ey: p.y, bx: b.e, by: b.f, w: eye.getScreenCTM()!.a };
  };

  const r = svg.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  await point(cx + 4000, cy);
  const right = at();
  await point(cx - 4000, cy);
  const left = at();
  await point(cx, cy - 4000);
  const up = at();

  const swing = right.ex - left.ex;
  const vert = up.ey - right.ey;
  /*
   * The body's own travel across the same three aims.
   *
   * Not asserted against zero, because it is not zero and should not be: bob
   * and breathe are running underneath this whole check, deliberately, since
   * the claim is that the gaze composes with the idle layers rather than that
   * it is the only thing moving. What the reservation in `motion.css` actually
   * promises is that the gaze lands on `.mo-eyes` alone, so the number that
   * matters is the ratio: the silhouette must not be swinging with the pointer.
   */
  const drift = Math.max(Math.abs(right.bx - left.bx), Math.abs(up.by - right.by));

  /*
   * The sphere, which is the claim the projection makes over the translate it
   * replaced: an eye turning away foreshortens, and one asked for more
   * excursion than the head has parks at the limb instead of leaving over the
   * page. Measured at an excursion far past anything the docs recommend,
   * because that is exactly the case a translate got wrong.
   */
  eyes.style.setProperty("--mo-track-travel", "24px");
  /* The excursion is read at measure time and cached as an angle, so a host
     that changes it has to say so. This is the same call `useGaze` makes after
     writing `travel`, and forgetting it is why that hook makes it. */
  g.remeasure();
  await point(cx + 4000, cy);
  const far = at();
  const bodyBox = body.getBoundingClientRect();
  const eyeBox = eye.getBoundingClientRect();
  const inside = eyeBox.right <= bodyBox.right + 1;
  /* The CTM's `a` is the horizontal scale the composed transform arrives at,
     which is the foreshortening times the pose's own — and the pose is idle
     here, so it is the foreshortening. */
  const shrunk = far.w < right.w * 0.5;
  eyes.style.setProperty("--mo-track-travel", `${TRAVEL}px`);
  g.remeasure();
  await point(cx + 4000, cy);

  /*
   * The subtree is replaced, which is what a name change does.
   *
   * The adapters hand `parts.inner` to `dangerouslySetInnerHTML` and the
   * geometry varies with the name, so React rewrites the whole subtree on every
   * keystroke while the `<svg>` itself survives. A driver holding the old
   * `.mo-eyes` then writes into a detached tree forever, and the eyes on screen
   * never move again — which is the hero of `blobatar.dev` after one keystroke.
   * Nothing in `bun test` can see it: the driver is behaving perfectly, on the
   * wrong nodes.
   */
  const root = host.querySelector(".mo-root")!;
  root.innerHTML = root.innerHTML;
  const newEye = host.querySelectorAll(".mo-eye")[1] as SVGGElement;
  const g2 = newEye.getBBox();
  const rest2 = new DOMPoint(g2.x + g2.width / 2, g2.y + g2.height / 2);
  await point(cx - 4000, cy);
  const swappedLeft = rest2.matrixTransform(newEye.getScreenCTM()!).x;
  await point(cx + 4000, cy);
  const swappedRight = rest2.matrixTransform(newEye.getScreenCTM()!).x;
  const swung = swappedRight - swappedLeft;

  /* Stood down: the rove has been damped to nothing while the gaze drives. */
  const held = await roveOver(200);
  const hold = parseFloat(
    getComputedStyle(host.querySelector(".mo-root")!).getPropertyValue("--mo-track-hold"),
  );

  g.stop();
  await frame();
  /* The live group, not the one captured before the subtree was replaced: the
     driver released the properties on the element it is actually driving, and
     the detached one keeps whatever it was last written. */
  const live = host.querySelector(".mo-eyes") as SVGGElement;
  const released = parseFloat(live.style.getPropertyValue("--mo-track-x") || "0");

  /*
   * A full left-to-right reversal is two excursions wide, and the direction is
   * normalised, so the eyes may not travel further than that however far away
   * the pointer is. Bounded above for that reason and not tightly: the group's
   * screen position carries breathe's scale and bob's offset at whichever phase
   * each sample landed on, so a few percent of residue is the idle layers this
   * check deliberately leaves running. The failure it is built to catch is an
   * excursion that is not bounded at all, which is multiples out rather than
   * percent.
   */
  const full = 2 * TRAVEL * perUnit;
  report(
    "J the gaze follows a pointer as a mark on a sphere, and moves only the eyes",
    swing > full * 0.7 &&
      swing <= full * 1.2 &&
      vert < -perUnit &&
      drift < swing * 0.3 &&
      inside &&
      shrunk &&
      swung > 2 * TRAVEL * perUnit * 0.5 &&
      roving > 0.5 &&
      held < roving * 0.05 &&
      hold > 0.98 &&
      released === 0,
    `eye swings ${swing.toFixed(1)}px of a ${full.toFixed(1)}px excursion, ` +
      `rise ${(-vert).toFixed(1)}px, body drifts ${drift.toFixed(2)}px; ` +
      `at 8× the excursion it stays inside the silhouette (${inside}) and ` +
      `foreshortens ${right.w.toFixed(1)}px → ${far.w.toFixed(1)}px; ` +
      `survives the subtree being replaced (${swung > 1 ? "swings " : "dead "}` +
      `${swung.toFixed(1)}px); ` +
      `rove ${roving.toFixed(2)}px stands down to ${held.toFixed(2)}px at ` +
      `hold ${hold.toFixed(3)}; released to ${released}`,
  );
  host.remove();
}

/**
 * Each check runs on its own, and a thrower names itself.
 *
 * One `try` around the whole sequence used to be the shape here, and it hid
 * more than it caught. When `checkRock` threw in Gecko, the run reported
 * `harness` plus a line number in a bundle, the eight checks after it never
 * ran, and nothing in the output said so. A gate whose failure mode is "most of
 * the gate silently did not execute" is not reporting what it measured.
 *
 * Isolating them is safe because they already are: every check builds its own
 * host element and its own React root, and none reads another's state.
 */
const CHECKS: [string, () => Promise<void>][] = [
  ["checkGeometry", checkGeometry],
  ["checkRock", checkRock],
  ["checkBlink", checkBlink],
  ["checkLive", checkLive],
  ["checkDirections", checkDirections],
  ["checkTint", checkTint],
  ["checkContinuity", checkContinuity],
  ["checkShake", checkShake],
  ["checkPacing", checkPacing],
  ["checkGaze", checkGaze],
];

(async () => {
  for (const [name, check] of CHECKS) {
    try {
      await check();
    } catch (err) {
      report(`harness ${name} threw`, false, String((err as Error)?.stack ?? err));
    }
  }
  // Posted back rather than read out of the browser, which is what lets the
  // driver run this in Gecko as well as Blink without speaking two debugging
  // protocols. The global stays for a hand-run in a real window.
  (globalThis as { RESULTS?: Result[] }).RESULTS = results;
  await fetch("/result", { method: "POST", body: JSON.stringify(results) });
})();
