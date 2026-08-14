import { describe, expect, test } from "bun:test";
import { FLOORS, contrast, ensureContrast, palette, ramp, type Variant } from "../src/color";
import { traits } from "../src/traits";

/** Every hue, at 1° resolution — the guarantee is only worth stating if it holds everywhere. */
const HUES = Array.from({ length: 360 }, (_, i) => i);
const VARIANTS: Variant[] = ["character", "blob"];

describe.each(VARIANTS)("%s", variant => {
  const floors = FLOORS[variant];

  test.each(floors)("%s clears %s at %f:1 across every hue", (fg, bg, min) => {
    for (const h of HUES) {
      const r = ramp(h, variant);
      expect(contrast(r[fg]!, r[bg]!)).toBeGreaterThanOrEqual(min - 1e-9);
    }
  });

  test("the authored ramp clears the floors before enforcement runs", () => {
    // The guarantee is meant to be structural — fixed L/C ramps that are safe
    // at every hue — with ensureContrast as a net, not a load-bearing step.
    // If this ever fails, the ramp constants drifted and need re-authoring.
    for (const h of HUES) {
      const r = ramp(h, variant, false);
      for (const [fg, bg, min] of floors) {
        expect(contrast(r[fg]!, r[bg]!)).toBeGreaterThanOrEqual(min);
      }
    }
  });

  test("every hue resolves to a valid 6-digit hex", () => {
    for (const h of HUES) {
      for (const hex of Object.values(palette(h, variant))) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  test("hues stay distinguishable rather than collapsing to grey", () => {
    // If chroma reduction were too aggressive the whole wheel would flatten.
    expect(new Set(HUES.map(h => palette(h, variant).head)).size).toBeGreaterThan(200);
  });

  test("500 real seeds all satisfy the guarantee", () => {
    for (let i = 0; i < 500; i++) {
      const r = ramp(traits(`user-${i}`).num("hue", 0, 360), variant);
      for (const [fg, bg, min] of floors) {
        expect(contrast(r[fg]!, r[bg]!)).toBeGreaterThanOrEqual(min - 1e-9);
      }
    }
  });
});

describe("variant character", () => {
  test("fills the slots its renderer uses", () => {
    expect(Object.keys(palette(0, "character")).sort()).toEqual(["bg", "hair", "head", "ink"]);
  });
});

describe("variant blob", () => {
  test("fills the slots its renderer uses", () => {
    expect(Object.keys(palette(0, "blob")).sort()).toEqual(["bg", "eye", "head"]);
  });

  const TONES = [0.1, 0.3, 0.5, 0.7, 0.88, 0.97];

  test("eye polarity follows the body across every tone", () => {
    for (const h of HUES) {
      for (const tone of TONES) {
        const r = ramp(h, "blob", true, tone);
        // Light body gets dark eyes, dark body gets light eyes. Without the
        // flip the ink swatch would render an invisible face.
        expect(r.eye!.l < 0.5).toBe(r.head!.l >= 0.5);
        expect(contrast(r.eye!, r.head!)).toBeGreaterThanOrEqual(4.5 - 1e-9);
      }
    }
  });

  test("the tone set spans pale to near-black", () => {
    const ls = TONES.map(t => ramp(0, "blob", false, t).head!.l);
    expect(Math.min(...ls)).toBeLessThan(0.2);
    expect(Math.max(...ls)).toBeGreaterThan(0.85);
    expect(new Set(ls).size).toBe(TONES.length);
  });

  test("pale tones survive enforcement rather than being darkened away", () => {
    // The weak body/backdrop floor exists so soft swatches stay soft.
    for (const h of HUES) {
      expect(ramp(h, "blob", true, 0.3).head!.l).toBeGreaterThan(0.85);
    }
  });
});

describe("ensureContrast", () => {
  test("rescues a pair that starts far too close", () => {
    const bg = { l: 0.6, c: 0.1, h: 240 };
    const fg = { l: 0.62, c: 0.1, h: 240 };
    expect(contrast(fg, bg)).toBeLessThan(1.2);
    expect(contrast(ensureContrast(fg, bg, 4.5), bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("keeps the direction it is already leaning", () => {
    const bg = { l: 0.9, c: 0.05, h: 30 };
    const fg = { l: 0.85, c: 0.05, h: 30 };
    expect(ensureContrast(fg, bg, 4.5).l).toBeLessThan(fg.l); // darker, not flipped
  });

  test("flips direction when the lean runs out of range", () => {
    const bg = { l: 0.05, c: 0.02, h: 30 };
    const fg = { l: 0.04, c: 0.02, h: 30 };
    expect(contrast(ensureContrast(fg, bg, 7), bg)).toBeGreaterThanOrEqual(7);
  });

  test("leaves an already-passing pair untouched", () => {
    const bg = { l: 0.95, c: 0.02, h: 30 };
    const fg = { l: 0.1, c: 0.02, h: 30 };
    expect(ensureContrast(fg, bg, 4.5)).toBe(fg);
  });
});
