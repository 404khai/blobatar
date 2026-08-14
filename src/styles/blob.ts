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
 * in absolute units. Bodies here range from 24 to 44 units depending on how much
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

  // Where the eye pair sits as a unit. This is the gaze, and it does more work
  // for recognizability than any individual eye parameter.
  const gx = t.jitter("gaze.x", 0.16) * rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * ry;

  const gap = t.num("eye.gap", 0.18, 0.3) * rx;
  const er = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.9, 1.1);
  const eyeRy = er * ratio;

  // Lean is bounded by the gap rather than drawn freely. A tall capsule tilted
  // hard sweeps sideways by ry·sin(lean), and two of them meeting in the middle
  // of the face is the one failure this style cannot survive. Solving for the
  // lean that still leaves a channel keeps the tilt as generous as each eye's
  // own proportions allow, instead of capping every avatar at the angle the
  // tallest one could tolerate.
  const room = Math.max(0, Math.min(1, (gap - rx * 0.03 - er * scale) / (eyeRy * scale)));
  const lean = t.num("eye.lean", -1, 1) * Math.min(30, (Math.asin(room) * 180) / Math.PI);

  // Petals and lumps ride on a ring just outside the core, so they read as
  // part of the same creature rather than as satellites.
  const petals: { cx: number; cy: number; r: number }[] = [];

  if (shape === "sun") {
    const count = t.int("sun.n", 8, 11);
    const dist = r * t.num("sun.dist", 1.0, 1.1);
    const pr = r * t.num("sun.r", 0.17, 0.23);
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

export function render(l: Layout, p: Palette): string {
  const b = l.body;
  const core =
    l.shape === "organic" || l.shape === "cloud"
      ? blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, l.shape === "cloud" ? 0 : b.rot)
      : superellipse(b);

  const r2 = (v: number) => Math.round(v * 100) / 100;

  return (
    `<g fill="${p.head}">` +
    // Decoration first so the core sits on top and the eyes always land on it.
    // Petals are true circles, so <circle> costs about a quarter of what the
    // equivalent four-segment path would — and a sun carries eleven of them.
    l.petals
      .map(d => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`)
      .join("") +
    `<path d="${core}"/>` +
    `</g>` +
    `<g fill="${p.eye}">` +
    l.eyes.map(e => `<path d="${superellipse(e)}"/>`).join("") +
    `</g>`
  );
}

/**
 * No backdrop by default. The body *is* the avatar here, and a plate behind a
 * near-full-bleed shape just adds a rim of color that fights the silhouette.
 */
export const background = false as const;
