/**
 * SPIKE — a generation composed from shape values.
 *
 * A generation is `compose(bands, fit)`: which silhouettes, how the seed is
 * partitioned between them, and how the eye cluster is fitted into whatever
 * room a silhouette leaves. Bands live here rather than on the shape because
 * gen1 and gen2 draw six of the same silhouettes and weight them differently —
 * a `round` that carried its own threshold could only belong to one of them.
 *
 * `fit` is the other half of the same argument. gen1 measures the cluster
 * against the body radius on one axis; gen2 measures it against a per-shape
 * face on both. That is not a refinement that can be applied retroactively —
 * it would move every gen1 blobatar — so it is a parameter, and each
 * generation names the one it froze.
 */
import type { Palette } from "../color";
import { superellipse } from "../shape";
import type { Traits } from "../traits";
import type { Body, Deco, Ellipse, Shape } from "./shapes";

export interface Eye {
  cx: number; cy: number; rx: number; ry: number; n: number; rot: number;
}

export type Fit = (t: Traits, b: Body, face: Ellipse) => Eye[];

/*
 * The two strategies are written out rather than factored into shared helpers,
 * and the duplication is the point: a consumer carrying one generation carries
 * one of these, and a `cluster()`/`pair()` boundary that exists only so the two
 * can share costs that consumer bytes for a sharing they never use.
 */

/**
 * gen1: the cluster measured against the body radius, on one axis.
 *
 * `tight` is recovered from the face rather than stated twice — a shape whose
 * face is its whole body is one gen1 called unshrunk, and the spline shapes'
 * `min(radii) * 0.95` is exactly the shrink their face already describes.
 */
export const bodyFit: Fit = (t, b, face) => {
  const rx = b.rx;
  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;

  const gx = t.jitter("gaze.x", 0.09) * rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * b.ry;
  const tight = face.rx / rx;
  const need = (Math.abs(gx) + gap0 + Math.hypot(wide, tall)) / rx;
  const fit = need > tight * 0.9 ? (tight * 0.9) / need : 1;

  const er = er0 * fit;
  const eyeRy = er * ratio;
  const gap = gap0 * fit;
  const room = Math.max(0, Math.min(1, clearance / tall));
  const bound = Math.min(12, (Math.asin(room) * 180) / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  const lean2 = Math.max(-12, Math.min(12, lean + t.jitter("eye.lean2", 3.5)));

  return [
    { cx: b.cx + gx - gap, cy: b.cy + gy, rx: er, ry: eyeRy, n: t.num("eye.n", 3.5, 6), rot: lean },
    {
      cx: b.cx + gx + gap,
      cy: b.cy + gy + t.jitter("eye.dy", 0.04) * b.ry,
      rx: er * scale, ry: eyeRy * scale * stretch,
      n: t.num("eye.n", 3.5, 6), rot: lean2,
    },
  ];
};

/** gen2: the cluster measured against the shape's own face, on both axes. */
export const faceFit: Fit = (t, b, face) => {
  const rx = b.rx;
  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;

  const gx = t.jitter("gaze.x", 0.09) * face.rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * face.ry;
  const dy = t.jitter("eye.dy", 0.04) * face.ry;
  const reach = Math.hypot(wide, tall);
  const need = Math.hypot(
    (Math.abs(gx) + gap0 + reach) / face.rx,
    (Math.abs(gy) + Math.abs(dy) + reach) / face.ry,
  );
  const fit = need > 0.9 ? 0.9 / need : 1;

  const er = er0 * fit;
  const eyeRy = er * ratio;
  const gap = gap0 * fit;
  const room = Math.max(0, Math.min(1, clearance / tall));
  const bound = Math.min(12, (Math.asin(room) * 180) / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  const lean2 = Math.max(-12, Math.min(12, lean + t.jitter("eye.lean2", 3.5)));

  const cx = face.cx + gx * fit;
  const cy = face.cy + gy * fit;
  return [
    { cx: cx - gap, cy, rx: er, ry: eyeRy, n: t.num("eye.n", 3.5, 6), rot: lean },
    {
      cx: cx + gap, cy: cy + dy * fit,
      rx: er * scale, ry: eyeRy * scale * stretch,
      n: t.num("eye.n", 3.5, 6), rot: lean2,
    },
  ];
};

/** `[shape, upper edge of its band in [0, 1)]`, in order. Frozen per generation. */
export type Band = readonly [Shape, number];

export function compose(bands: Band[], fit: Fit) {
  const pick = (v: number) => (bands.find(([, upTo]) => v < upTo) ?? bands[bands.length - 1]!)[0];

  function layout(t: Traits) {
    const shape = pick(t("shape"));
    const r = t.num("body.r", 31, 38) * shape.core;
    const body: Body = {
      cx: 50 + t.jitter("body.x", 1.5),
      cy: 50 + t.jitter("body.y", 1.5),
      rx: r,
      ry: r * t.num("body.ratio", 0.92, 1.08),
      n: t.num("body.n", 1.9, 2.5),
      rot: 0,
      radii: Array.from({ length: t.int("body.pts", 6, 8) }, (_, i) => 1 + t.jitter(`body.r${i}`, 0.16)),
    };
    shape.body?.(t, body);

    // The body itself when the shape names no face, which is what a silhouette
    // convex around its own centre wants — and it already carries the four
    // fields a face is.
    const face = shape.face?.(body) ?? body;
    const deco: Deco = { petals: [], extra: [] };
    shape.decorate?.(t, body, deco);

    return {
      shape: shape.name,
      draw: shape.path,
      body, face,
      petals: deco.petals,
      extra: deco.extra,
      eyes: fit(t, body, face),
    };
  }

  function render(l: ReturnType<typeof layout>, p: Palette, mo?: boolean): string {
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const eye = (e: Eye, i: number) => {
      const path = `<path d="${superellipse(e)}"/>`;
      return mo
        ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
        : path;
    };
    const body =
      `<g fill="${p.head}">` +
      l.petals.map(d => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`).join("") +
      l.extra.map(s => `<path d="${superellipse(s)}"/>`).join("") +
      `<path d="${l.draw ? l.draw(l.body) : superellipse(l.body)}"/>` +
      `</g>` +
      `<g fill="${p.eye}"${mo ? ` class="mo-eyes"` : ""}>` +
      l.eyes.map(eye).join("") +
      `</g>`;
    return mo ? `<g class="mo-breathe"><g class="mo-bob">${body}</g></g>` : body;
  }

  return { layout, render, background: false as const };
}
