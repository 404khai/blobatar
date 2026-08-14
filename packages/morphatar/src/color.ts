/**
 * Palette construction.
 *
 * Hue is the only value the seed controls. Lightness and chroma are authored
 * constants, which is what makes every avatar look like it came from the same
 * designer rather than from a random number generator.
 *
 * Colors are resolved to hex rather than emitted as `oklch()`. Browsers handle
 * `oklch()` in SVG fine, but server-side rasterizers (resvg, librsvg, sharp)
 * largely do not — and avatars get rasterized server-side constantly. Doing the
 * conversion here also means the contrast guarantee is enforced against real
 * sRGB luminance instead of assumed from OKLab lightness, which drifts by up to
 * ~1.4:1 between hues at equal L.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Every color slot any style can use. Each style fills the subset it needs. */
export type ColorKey = "bg" | "head" | "hair" | "ink" | "eye";
export type Palette = Partial<Record<ColorKey, string>>;

/** OKLCh -> linear-light sRGB. Components may fall outside [0,1] (out of gamut). */
function toLinear({ l, c, h }: Oklch): [number, number, number] {
  const r = (h * Math.PI) / 180;
  const a = c * Math.cos(r);
  const b = c * Math.sin(r);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const inGamut = (rgb: number[]) => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * Resolves to in-gamut linear sRGB, reducing chroma if needed.
 *
 * Chroma is the right axis to give up: lowering it desaturates, while clipping
 * channels shifts hue — a clipped vivid blue turns purple.
 */
function resolve(color: Oklch): [number, number, number] {
  let rgb = toLinear(color);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(toLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    rgb = toLinear({ ...color, c: lo });
  }
  return rgb.map(v => Math.min(1, Math.max(0, v))) as [number, number, number];
}

/**
 * WCAG relative luminance. The values coming out of `resolve` are already
 * linear-light sRGB, which is exactly what WCAG's piecewise transfer function
 * produces — so this needs no further linearization.
 */
function luminance(color: Oklch): number {
  const [r, g, b] = resolve(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Oklch, b: Oklch): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Pushes `fg`'s lightness away from `bg` until the pair clears `min`.
 *
 * Walks in the direction it is already leaning first, so a dark ink on a light
 * head gets darker rather than flipping to light. If that direction runs out of
 * range, it tries the other way before giving up at pure black or white.
 */
export function ensureContrast(fg: Oklch, bg: Oklch, min: number): Oklch {
  if (contrast(fg, bg) >= min) return fg;

  const lean = fg.l >= bg.l ? 1 : -1;
  for (const dir of [lean, -lean]) {
    const probe = { ...fg };
    for (let i = 0; i < 60; i++) {
      probe.l = Math.min(1, Math.max(0, probe.l + dir * 0.02));
      if (contrast(probe, bg) >= min) return probe;
      if (probe.l === 0 || probe.l === 1) break;
    }
  }

  // Unreachable for the authored ramps, but a palette override could get here.
  const black = { ...fg, l: 0, c: 0 };
  const white = { ...fg, l: 1, c: 0 };
  return contrast(black, bg) >= contrast(white, bg) ? black : white;
}

export function toHex(color: Oklch): string {
  return (
    "#" +
    resolve(color)
      .map(v => {
        const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        return Math.round(s * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export type Variant = "character" | "blob";

/**
 * The `blob` tone set.
 *
 * This is the one place a variant is allowed to move lightness and chroma, not
 * just hue — a body vocabulary this varied looks monotonous in a single tone.
 * Letting the seed roam freely over L and C is what makes generated palettes
 * look generated, so instead it picks from six authored swatches: the same
 * discipline as a designer handing you a set, rather than a slider.
 *
 * Thresholds are cumulative, so pale and mid tones dominate and the near-black
 * body stays a rare find.
 */
const TONES: [number, { l: number; c: number }][] = [
  [0.2, { l: 0.86, c: 0.085 }], // pastel
  [0.36, { l: 0.9, c: 0.028 }], // pale neutral
  [0.62, { l: 0.73, c: 0.135 }], // mid
  [0.8, { l: 0.62, c: 0.165 }], // deep
  [0.93, { l: 0.87, c: 0.16 }], // bright
  [1.0, { l: 0.17, c: 0.02 }], // ink
];

const toneAt = (v: number) => TONES.find(([edge]) => v < edge)?.[1] ?? TONES[0]![1];

/**
 * Authored ramps. `character` moves hue only; `blob` also picks a tone.
 */
const RAMPS: Record<Variant, (h: number, tone: number) => Record<string, Oklch>> = {
  character: h => ({
    bg: { l: 0.91, c: 0.055, h },
    head: { l: 0.74, c: 0.11, h: h + 22 },
    hair: { l: 0.34, c: 0.075, h: h - 30 },
    ink: { l: 0.22, c: 0.03, h: h + 8 },
  }),
  blob: (h, tone) => {
    const t = toneAt(tone);
    return {
      bg: { l: 0.965, c: 0.01, h },
      head: { l: t.l, c: t.c, h },
      // Polarity follows the body: dark eyes on a light body, light eyes on a
      // dark one. Without this the ink tone would render an invisible face.
      eye: t.l >= 0.5 ? { l: 0.17, c: 0.02, h } : { l: 0.97, c: 0.012, h },
    };
  },
};

/**
 * Minimum contrast ratios as [foreground, background, ratio], applied in order.
 * Later pairs resolve against already-final earlier colors, so the chain
 * converges. `4.5` on the facial features is the WCAG text floor: eyes and
 * mouth are small marks that have to read at 24px.
 */
const FLOORS: Record<Variant, [string, string, number][]> = {
  character: [
    ["head", "bg", 1.6],
    ["hair", "bg", 2.0],
    ["ink", "head", 4.5],
  ],
  // `blob` gets a deliberately weak body/backdrop floor. Its backdrop is off by
  // default, and the pale swatches are meant to sit quietly on a light surface —
  // forcing 1.6:1 there would darken exactly the tones the style exists for.
  // The eye floor is the one that matters, and it is the full text ratio.
  blob: [
    ["head", "bg", 1.25],
    ["eye", "head", 4.5],
  ],
};

export { FLOORS };

/** The palette in OKLCh, before hex encoding. The test suite asserts against this. */
export function ramp(
  hue: number,
  variant: Variant = "blob",
  enforce = true,
  tone = 0,
): Record<string, Oklch> {
  const r = RAMPS[variant](hue, tone);
  if (enforce) {
    for (const [fg, bg, min] of FLOORS[variant]) {
      r[fg] = ensureContrast(r[fg]!, r[bg]!, min);
    }
  }
  return r;
}

export function palette(
  hue: number,
  variant: Variant = "blob",
  enforce = true,
  tone = 0,
): Palette {
  const r = ramp(hue, variant, enforce, tone);
  const out: Palette = {};
  for (const k in r) out[k as ColorKey] = toHex(r[k]!);
  return out;
}
