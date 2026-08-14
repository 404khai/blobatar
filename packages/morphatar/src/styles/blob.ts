import type { Palette } from "../color";
import { blobPath, superellipse } from "../shape";
import type { Traits } from "../traits";

/**
 * A soft body and two capsule eyes.
 *
 * The silhouette carries the identity here, so it comes from a vocabulary of
 * six: a plain round, a tilted box, a lopsided organic pebble, a lumpy cloud, a
 * petalled sun, and a round body with a nub growing off it. Everything is drawn
 * in one fill color inside a single `<g>`, which means overlapping parts union
 * visually with no boolean geometry and no clip paths.
 *
 * Every eye dimension is expressed as a fraction of the body radius rather than
 * in absolute units. Bodies here range from 22 to 38 units depending on how much
 * room the decoration needs, and absolute eye sizes would drift off a small sun
 * while looking lost on a large round.
 */

export type Shape = "round" | "boxy" | "organic" | "cloud" | "sun" | "nub";

/**
 * Weighted rather than uniform: rounds and pebbles are the everyday shapes, and
 * suns and clouds are the ones you want to be pleased to see. Thresholds are
 * frozen per major, exactly like a `pick` array.
 */
function shapeOf(v: number): Shape {
  return v < 0.28 ? "round"
    : v < 0.58 ? "organic"
    : v < 0.72 ? "boxy"
    : v < 0.84 ? "nub"
    : v < 0.93 ? "cloud"
    : "sun";
}

/** How much of the frame the core body takes, leaving room for decoration. */
const CORE: Record<Shape, number> = {
  round: 1,
  boxy: 0.86,
  organic: 0.98,
  cloud: 0.78,
  sun: 0.7,
  nub: 0.88,
};

export function layout(t: Traits) {
  const shape = shapeOf(t("shape"));
  const r = t.num("body.r", 31, 38) * CORE[shape];
  const rx = r;
  const ry = r * t.num("body.ratio", 0.92, 1.08);

  const body = {
    cx: 50 + t.jitter("body.x", 1.5),
    cy: 50 + t.jitter("body.y", 1.5),
    rx,
    ry,
    n: shape === "boxy" ? t.num("body.n", 3.4, 6) : t.num("body.n", 1.9, 2.5),
    rot: shape === "boxy" ? t.num("body.rot", -20, 20) : 0,
    // Lopsided by ±16%, which is enough to read as hand-drawn and not so much
    // that the eyes can end up on a bulge instead of the face.
    radii: Array.from({ length: t.int("body.pts", 6, 8) }, (_, i) =>
      1 + t.jitter(`body.r${i}`, 0.16),
    ),
  };

  // Where the eye pair sits as a unit. Gaze is deliberately a small effect: at
  // avatar sizes it reads as jitter rather than as direction, and the budget it
  // used to spend is worth more in the gap below.
  const gx = t.jitter("gaze.x", 0.09) * rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * ry;

  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.9, 1.1);

  // The gap is measured from the eye's own edge outward, not from the body
  // center. Drawn independently, a large eye and a small gap co-occur and
  // produce two capsules crammed together with no room left to tilt — and
  // because the lean bound below is derived from that clearance, those same
  // seeds also came out untilted. Deriving the gap fixes both at once.
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  const gap0 = er0 * scale + rx * 0.03 + clearance;

  // Containment by construction rather than by hope. Each range is safe on its
  // own, but their simultaneous extremes are not, and a 2000-seed test only
  // samples that corner — it does not rule it out. Measuring the cluster against
  // the tightest radius the body actually reaches and scaling it as a unit makes
  // the guarantee hold across the whole space.
  const tight = shape === "organic" || shape === "cloud" ? Math.min(...body.radii) * 0.95 : 1;
  const need = (Math.abs(gx) + gap0 + Math.hypot(er0 * scale, er0 * ratio * scale)) / rx;
  const fit = need > tight * 0.9 ? (tight * 0.9) / need : 1;

  const er = er0 * fit;
  const gap = gap0 * fit;
  const eyeRy = er * ratio;

  // Lean is bounded by that clearance rather than drawn freely. A tall capsule
  // tilted hard sweeps sideways by ry·sin(lean), and two of them meeting in the
  // middle of the face is the one failure this style cannot survive.
  const room = Math.max(0, Math.min(1, (clearance * fit) / (eyeRy * scale)));
  const lean = t.num("eye.lean", -1, 1) * Math.min(30, (Math.asin(room) * 180) / Math.PI);

  // Petals and lumps ride on a ring just outside the core, so they read as
  // part of the same creature rather than as satellites.
  const petals: { cx: number; cy: number; r: number }[] = [];

  if (shape === "sun") {
    const count = t.int("sun.n", 6, 9);
    const dist = r * t.num("sun.dist", 1.0, 1.08);
    const pr = r * t.num("sun.r", 0.2, 0.26);
    const off = t.num("sun.rot", 0, 2 * Math.PI);
    for (let i = 0; i < count; i++) {
      const a = off + (2 * Math.PI * i) / count;
      petals.push({ cx: body.cx + Math.cos(a) * dist, cy: body.cy + Math.sin(a) * dist, r: pr });
    }
  } else if (shape === "cloud") {
    // Lobes ride the upper half only, so the silhouette stays a cloud rather
    // than a flower.
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
  }

  return {
    shape,
    body,
    petals,
    eyes: [
      { cx: body.cx + gx - gap, cy: body.cy + gy, rx: er, ry: eyeRy,
        n: t.num("eye.n", 3.5, 6), rot: lean },
      {
        cx: body.cx + gx + gap,
        cy: body.cy + gy + t.jitter("eye.dy", 0.04) * ry,
        // The far eye is slightly larger here, not smaller — it reads as
        // personality rather than as a perspective mistake.
        rx: er * scale,
        ry: eyeRy * scale,
        n: t.num("eye.n", 3.5, 6),
        rot: lean + t.jitter("eye.lean2", 8),
      },
    ],
  };
}

export type Layout = ReturnType<typeof layout>;

/**
 * `mo` carries the root class when animating, and is absent otherwise — so the
 * static path emits byte-identical markup to what it always has.
 *
 * The nesting is not decoration. An element has one `transform` property, so
 * hover-lift, breathe and bob have to live on separate elements or they
 * overwrite each other. Eyes get their own class because blink scales each one
 * about its own center; applied to the shared group, they slide toward the
 * group center instead of closing.
 */
export function render(l: Layout, p: Palette, mo?: string): string {
  const b = l.body;
  const core =
    l.shape === "organic" || l.shape === "cloud"
      ? blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, l.shape === "cloud" ? 0 : b.rot)
      : superellipse(b);

  const r2 = (v: number) => Math.round(v * 100) / 100;

  const eye = mo ? `<path class="mo-eye" d=` : `<path d=`;

  const body =
    `<g fill="${p.head}">` +
    // Decoration first so the core sits on top and the eyes always land on it.
    // Petals are true circles, so <circle> costs about a quarter of what the
    // equivalent four-segment path would — and a sun carries up to nine of them.
    l.petals
      .map(d => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`)
      .join("") +
    `<path d="${core}"/>` +
    `</g>` +
    // The eye group already existed to share a fill, and it is exactly the
    // element the saccade layer needs: both eyes must move as one, because
    // independent movement reads as a lazy eye instantly. Blink stays on the
    // individual paths underneath it.
    `<g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` +
    l.eyes.map(e => `${eye}"${superellipse(e)}"/>`).join("") +
    `</g>`;

  return mo
    ? `<g class="${mo}"><g class="mo-breathe"><g class="mo-bob">${body}</g></g></g>`
    : body;
}

/**
 * No backdrop by default. The body *is* the avatar here, and a plate behind a
 * near-full-bleed shape just adds a rim of color that fights the silhouette.
 */
export const background = false as const;
