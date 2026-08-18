import type { Palette } from "../color";
import { blobPath, polygon, superellipse, type Superellipse } from "../shape";
import type { Traits } from "../traits";

/**
 * The second generation: gen1's six silhouettes plus four more.
 *
 * `round`, `organic`, `boxy`, `nub`, `cloud` and `sun` carry over under their
 * own names and are built the same way. `capsule`, `triangle`, `hexagon` and
 * `droplet` are new. Everything is still drawn in one fill inside a single
 * `<g>`, which is what lets a capsule be a rectangle between two circles and a
 * droplet be a bulb behind a taper — parts union visually with no boolean
 * geometry and no clip paths.
 *
 * **Not a fork of the renderer.** The eye serialization below is a near-copy of
 * `styles/blob.ts`'s, and it is a copy on purpose: gen1 is frozen forever, so a
 * shared helper would put every future generation one refactor away from moving
 * a byte in `test/golden/gen1.txt`. A generation is a band table, a `CORE`
 * table, decoration branches and the markup they serialize to — and each one
 * owns all four. See `docs/adr/0006-generations.md`.
 *
 * The one structural difference from gen1 is `face`: the region the eye cluster
 * has to fit inside, computed per shape rather than derived from the body
 * radius. gen1 could get away with the body itself because all six of its
 * silhouettes were roughly as wide as they were tall and roughly convex around
 * their center. A point-up triangle is neither — its inscribed circle is half
 * its circumradius — and a droplet's bulb is not even centered on the frame. So
 * the layout states the face once, and everything about the eyes is measured
 * against that instead.
 */

export type Shape =
  | "round"
  | "organic"
  | "boxy"
  | "nub"
  | "cloud"
  | "sun"
  | "capsule"
  | "triangle"
  | "hexagon"
  | "droplet";

/**
 * Ten bands over [0, 1), and deliberately not ten equal ones.
 *
 * gen1's weighting said rounds and pebbles are everyday and suns are a find,
 * and that is a claim about what a *wall* of blobatars looks like, not about
 * any single one. Splitting the same interval ten ways would have kept the
 * ordering and lost the claim: every shape rarer, and the four new silhouettes
 * — all of which read louder than a pebble — landing often enough to make a
 * grid noisier than gen1's.
 *
 * So the quiet half keeps the mass. `round` and `organic` still take a little
 * under half of the space between them, `boxy` and `capsule` are the other two
 * shapes that can repeat down a column without drawing attention, and the six
 * that carry a silhouette you notice — nub, cloud, droplet, hexagon, sun,
 * triangle — share the last 30%, with `triangle` rarest because it is the one
 * shape here with no curve in its outline at all.
 *
 * Frozen per generation, exactly like a `pick` array. `test/golden/gen2.txt`
 * records the histogram these produce.
 */
function shapeOf(v: number): Shape {
  return v < 0.22
    ? "round"
    : v < 0.48
      ? "organic"
      : v < 0.6
        ? "boxy"
        : v < 0.7
          ? "capsule"
          : v < 0.79
            ? "nub"
            : v < 0.86
              ? "cloud"
              : v < 0.915
                ? "droplet"
                : v < 0.95
                  ? "hexagon"
                  : v < 0.98
                    ? "sun"
                    : "triangle";
}

/**
 * How much of the frame the core body takes.
 *
 * Two jobs, and the new entries lean on the second. It leaves room for whatever
 * decoration a shape grows — that is the sun's 0.7 and the cloud's 0.78 — and
 * it equalizes *apparent* size across silhouettes that enclose very different
 * areas at the same radius. A triangle inscribed in a circle covers 41% of it,
 * so a triangle drawn at a round's radius reads as a much smaller creature;
 * 1.15 is what puts it back. The hexagon's 83% needs far less, and the
 * droplet's is a room allowance again — its taper reaches 1.43·ry above center.
 */
const CORE: Record<Shape, number> = {
  round: 1,
  organic: 0.98,
  boxy: 0.86,
  cloud: 0.78,
  sun: 0.7,
  nub: 0.88,
  capsule: 1.02,
  triangle: 1.15,
  hexagon: 1.05,
  droplet: 0.78,
};

export function layout(t: Traits) {
  const shape = shapeOf(t("shape"));
  const r = t.num("body.r", 31, 38) * CORE[shape];
  // A capsule is a body that is deliberately wider than it is tall — that is
  // the whole read — so it takes a second factor on `ry` rather than trying to
  // reach the same place through `body.ratio`, which every other shape shares.
  const squat = shape === "capsule" ? t.num("capsule.squat", 0.55, 0.68) : 1;
  const rx = r;
  const ry = r * t.num("body.ratio", 0.92, 1.08) * squat;

  const cx = 50 + t.jitter("body.x", 1.5);
  const cy = 50 + t.jitter("body.y", 1.5);

  const body = {
    cx,
    // The droplet's bulb is not centered on the frame: the taper above it has
    // to go somewhere, so the whole body sits low and the tip claims the room.
    cy: cy + (shape === "droplet" ? 0.22 * ry : 0),
    rx,
    ry,
    n: shape === "boxy" ? t.num("body.n", 3.4, 6) : t.num("body.n", 1.9, 2.5),
    // Rotation is free on a polygon — a vertex is `(rx·cos a, ry·sin a)`, so it
    // never leaves the bounding box however far it turns. The ranges are taste:
    // a hexagon reads as a hexagon at any angle, and a triangle stops looking
    // like it is resting on its base past about five degrees.
    rot:
      shape === "boxy"
        ? t.num("body.rot", -20, 20)
        : shape === "hexagon"
          ? t.num("body.rot", -12, 12)
          : shape === "triangle"
            ? t.num("body.rot", -5, 5)
            : 0,
    radii: Array.from(
      { length: t.int("body.pts", 6, 8) },
      (_, i) => 1 + t.jitter(`body.r${i}`, 0.16),
    ),
    sides: shape === "triangle" ? 3 : 6,
    // Read only where it is drawn, so the editor can gate the control on the
    // same condition the layout gates the value on.
    round:
      shape === "triangle" || shape === "hexagon"
        ? t.num("poly.round", 0.24, 0.5)
        : 0,
  };

  /**
   * The region the eyes have to fit inside — an ellipse inscribed in whatever
   * the silhouette actually is, which for half of this roster is nowhere near
   * the body's own radii.
   *
   * The hexagon's 0.84 is just under its inradius, `cos(π/6)` = 0.866. The
   * triangle's would be 0.5 by the same rule and that is the wrong shape to ask
   * for: a circle inscribed in a point-up triangle throws away the room the
   * creature actually has, which is a wide shallow band above the base, and the
   * eyes come out visibly smaller than every other silhouette's.
   *
   * So the triangle's face is an ellipse — low, wide, flat — sized by the
   * support function rather than by eye. In unit space the base sits at y = 0.5
   * and each slant edge is 0.5 from the centre, and an ellipse's reach along a
   * normal `(nx, ny)` is `hypot(a·nx, b·ny)`. At (0, 0.10) with semi-axes
   * (0.54, 0.36) that is 0.362 against the base with 0.400 of room and 0.512
   * against the slants with 0.542 — checked at the worst of the ±5° the polygon
   * may turn, which is where both margins are thinnest. Anisotropy is free:
   * `rx`/`ry` scale the triangle and this ellipse identically, and an affine map
   * preserves containment.
   */
  const smallest = Math.min(...body.radii) * 0.95;
  const face =
    shape === "organic" || shape === "cloud"
      ? { cx, cy, rx: rx * smallest, ry: ry * smallest }
      : shape === "triangle"
        ? { cx, cy: cy + ry * 0.1, rx: rx * 0.54, ry: ry * 0.36 }
        : shape === "hexagon"
          ? { cx, cy, rx: rx * 0.84, ry: ry * 0.84 }
          : shape === "capsule"
            ? // The stadium contains the ellipse of the same radii, so the only
              // margin needed here is against the caps' curvature.
              { cx, cy, rx: rx * 0.94, ry: ry * 0.94 }
            : shape === "droplet"
              ? { cx, cy: body.cy + ry * 0.05, rx: rx * 0.88, ry: ry * 0.88 }
              : { cx, cy, rx, ry };

  // Eyes are *sized* against the body and *placed* inside the face, and the
  // split is the whole reason both exist. Sizing against the face was the first
  // thing tried and it makes a triangle's eyes tiny — the face is 0.54 of the
  // body there, so the eyes come out about half the size of a round's on a
  // creature the same size on screen. What varies between silhouettes is how
  // much room there is to put a face in, not how big a face should be, so the
  // ranges below stay in body units and `fit` shrinks the cluster only where it
  // genuinely does not go.
  //
  // Where the pair sits within that room is a fraction of the face, since it is
  // a position rather than a dimension.
  const gx = t.jitter("gaze.x", 0.09) * face.rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * face.ry;

  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);

  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  // Drawn here rather than at the point of use, because it is the second eye's
  // own vertical offset and the bound below has to know about it. gen1 applied
  // it after its clamp, which is the one way an eye there can end up a fraction
  // outside the body it was fitted into.
  const dy = t.jitter("eye.dy", 0.04) * face.ry;
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;

  /**
   * Containment by construction, on both axes.
   *
   * gen1 measured the cluster against one radius, which was enough when every
   * body was roughly circular. A capsule is not: at the bottom of its `squat`
   * range it is barely half as tall as it is wide, and a bound stated in `rx`
   * alone would let a tall capsule eye run straight out through the top of it.
   * So both axes are stated, each as a fraction of the face's own radius.
   *
   * `reach` is the eye's corner distance, which bounds it at every rotation —
   * the lean is drawn below and cannot be known yet.
   *
   * The two are then combined with a **hypotenuse, not a maximum**, and that is
   * not conservatism for its own sake. The face is an *ellipse*, so satisfying
   * each axis separately proves nothing: 0.9 of the way out on both at once is
   * √2 times too far and lands outside. And the two extremes are reached at the
   * same place — the outer corner of the outer eye is simultaneously the
   * furthest point horizontally and vertically — so the hypotenuse is not
   * merely safe here, it is nearly tight. Every term scales with `fit`, which
   * is what makes solving for it a division.
   */
  const reach = Math.hypot(wide, tall);
  const need = Math.hypot(
    (Math.abs(gx) + gap0 + reach) / face.rx,
    (Math.abs(gy) + Math.abs(dy) + reach) / face.ry,
  );
  const fit = need > 0.9 ? 0.9 / need : 1;

  const er = er0 * fit;
  const gap = gap0 * fit;
  const eyeRy = er * ratio;

  // Same 12° ceiling and the same clearance-derived bound as gen1: past roughly
  // that much a tilt stops reading as a tilt and starts reading as a mistake.
  const MAX_LEAN = 12;
  const room = Math.max(0, Math.min(1, clearance / tall));
  const bound = Math.min(MAX_LEAN, (Math.asin(room) * 180) / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  const lean2 = Math.max(
    -MAX_LEAN,
    Math.min(MAX_LEAN, lean + t.jitter("eye.lean2", 3.5)),
  );

  // True circles, drawn as `<circle>` at about a quarter the bytes of the
  // equivalent path. Petals, lumps, nubs — and a capsule's two end caps, which
  // are decoration in the markup and silhouette to the eye.
  const petals: { cx: number; cy: number; r: number }[] = [];
  // Parts that need a superellipse rather than a circle. One so far: the
  // droplet's taper, which is a low-`n` diamond with its lower half buried in
  // the bulb, so what surfaces is a point.
  const extra: Superellipse[] = [];

  if (shape === "sun") {
    const count = t.int("sun.n", 6, 9);
    const dist = r * t.num("sun.dist", 1.0, 1.08);
    const pr = r * t.num("sun.r", 0.2, 0.26);
    const off = t.num("sun.rot", 0, 2 * Math.PI);
    for (let i = 0; i < count; i++) {
      const a = off + (2 * Math.PI * i) / count;
      petals.push({
        cx: body.cx + Math.cos(a) * dist,
        cy: body.cy + Math.sin(a) * dist,
        r: pr,
      });
    }
  } else if (shape === "cloud") {
    const count = t.int("cloud.n", 4, 6);
    for (let i = 0; i < count; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / count;
      petals.push({
        cx: body.cx + Math.cos(a) * r * 0.8,
        cy: body.cy + Math.sin(a) * r * 0.5,
        r: r * t.num(`cloud.r${i}`, 0.44, 0.62),
      });
    }
  } else if (shape === "nub") {
    const count = t.int("nub.n", 1, 2);
    for (let i = 0; i < count; i++) {
      const a = t.num(`nub.a${i}`, 0, 2 * Math.PI);
      petals.push({
        cx: body.cx + Math.cos(a) * r * 0.88,
        cy: body.cy + Math.sin(a) * r * 0.88,
        r: r * t.num(`nub.r${i}`, 0.24, 0.4),
      });
    }
  } else if (shape === "capsule") {
    // Two caps of radius `ry` centred `rx - ry` out, so the union spans exactly
    // 2·rx and ends in half-circles. The core drawn between them is the same
    // rectangle less its two cap widths — see `render`.
    for (const s of [-1, 1]) {
      petals.push({ cx: body.cx + s * (rx - ry), cy: body.cy, r: ry });
    }
  } else if (shape === "droplet") {
    extra.push({
      cx: body.cx,
      cy: body.cy - ry * 0.35,
      rx: rx * t.num("droplet.w", 0.5, 0.64),
      ry: ry * t.num("droplet.tip", 1.05, 1.3),
      // Low n is what makes the tip a point rather than a dome: at 1.25 the
      // quadrant is nearly a straight line, which is a diamond.
      n: t.num("droplet.n", 1.25, 1.5),
    });
  }

  return {
    shape,
    body,
    face,
    petals,
    extra,
    eyes: [
      {
        cx: face.cx + gx * fit - gap,
        cy: face.cy + gy * fit,
        rx: er,
        ry: eyeRy,
        n: t.num("eye.n", 3.5, 6),
        rot: lean,
      },
      {
        cx: face.cx + gx * fit + gap,
        cy: face.cy + gy * fit + dy * fit,
        rx: er * scale,
        ry: eyeRy * scale * stretch,
        n: t.num("eye.n", 3.5, 6),
        rot: lean2,
      },
    ],
  };
}

export type Layout = ReturnType<typeof layout>;

/**
 * Same markup contract as gen1, down to the byte layout of the animated case:
 * `mo` is set when animating and absent otherwise, the nesting exists because
 * an element has one `transform`, and the hover-lift root is the caller's. The
 * long-form reasoning for every one of those lives on `render` in
 * `styles/blob.ts` and is not repeated here.
 */
export function render(l: Layout, p: Palette, mo?: boolean): string {
  const b = l.body;
  const core =
    l.shape === "organic" || l.shape === "cloud"
      ? blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, l.shape === "cloud" ? 0 : b.rot)
      : l.shape === "triangle" || l.shape === "hexagon"
        ? polygon(b)
        : l.shape === "capsule"
          ? // The bar between the caps. `n: 6` squares its ends off, which the
            // caps then cover completely — a rounder core would leave two
            // pinches where the three parts meet.
            superellipse({ ...b, rx: b.rx - b.ry, n: 6 })
          : superellipse(b);

  const r2 = (v: number) => Math.round(v * 100) / 100;

  const eye = (e: Layout["eyes"][number], i: number) => {
    const path = `<path d="${superellipse(e)}"/>`;
    return mo
      ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
      : path;
  };

  const body =
    `<g fill="${p.head}">` +
    // Decoration under the core, so the core always wins where they overlap and
    // the eyes always land on it.
    l.petals
      .map((d) => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`)
      .join("") +
    l.extra.map((s) => `<path d="${superellipse(s)}"/>`).join("") +
    `<path d="${core}"/>` +
    `</g>` +
    `<g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` +
    l.eyes.map(eye).join("") +
    `</g>`;

  return mo
    ? `<g class="mo-breathe"><g class="mo-bob">${body}</g></g>`
    : body;
}

/** No backdrop, for the reason gen1 gives: the body *is* the blobatar. */
export const background = false as const;
