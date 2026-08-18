import { describe, expect, test } from "bun:test";
import { traits as reader } from "blobatar";
import { AXES, GENS, SHAPES, TONES, bandIndex, bandValue, round3, type Gen } from "./axes";
import { blobLayout, resolved } from "./resolved";

/**
 * What is tested here is not the panel — it is the handful of constants this
 * app copied out of the library, and the arithmetic that reads values back out
 * of a resolved layout. Both are couplings to numbers that live somewhere else,
 * and both fail silently: a retuned band moves every config anyone saved, and a
 * retuned range leaves the clamp readback quietly pointing at the wrong place.
 */

const NAME = "alain00";

/**
 * Everything below runs against every generation on offer, not just the
 * default. The tables in `axes.ts` are per-generation now and each one is its
 * own copy of somebody else's constants — a second generation whose midpoints
 * were transcribed wrong would pass a suite that only checked the first.
 */
const DEFAULT: Gen = 1;

describe("the bands copied out of the library", () => {
  test("every shape midpoint still selects the shape it names", () => {
    // The package pins these too, in `test/traits.test.ts`. Pinned again here
    // because it is *this* copy that the editor writes into people's code, and
    // a copy that agrees with nothing is the failure mode worth catching.
    for (const gen of GENS) {
      for (const { name, at } of SHAPES[gen]) {
        expect(`gen${gen} ${blobLayout(NAME, { shape: at }, gen).shape}`).toBe(`gen${gen} ${name}`);
      }
    }
  });

  test("every tone midpoint lands in a different swatch", () => {
    // `toneAt` splits [0, 1) into six, and nothing in the package pins where.
    // Distinct head colours is the cheapest statement of "still six bands, and
    // these six positions still find them".
    const heads = TONES.map(t => blobLayout(NAME, { tone: t.at }, DEFAULT).palette.head);
    expect(new Set(heads).size).toBe(TONES.length);
  });

  test("banded axes round-trip through their detents", () => {
    for (const axis of GENS.flatMap(g => AXES[g])) {
      if (!axis.bands) continue;
      for (let i = 0; i < axis.bands; i++) {
        expect(bandIndex(bandValue(i, axis.bands), axis.bands)).toBe(i);
      }
    }
  });

  test("a pinned value survives the round trip the panel puts it through", () => {
    // Pinning rounds; the library clamps. If either moved the number, the
    // snippet would state something the blobatar disagrees with.
    for (const v of [0, 0.001, 0.5, 0.999]) {
      expect(reader(NAME, true, { "eye.gap": round3(v) })("eye.gap")).toBe(v);
    }
  });
});

describe("reading the clamp back", () => {
  /*
   * The corner everyone tries first — biggest eyes, widest gap, tallest capsule
   * — on an organic body, which is where it actually bites. `fit` measures the
   * cluster against the *tightest* radius the body reaches, and a round body's
   * is its only one: on a round or boxy silhouette this same map fits with room
   * to spare, and reports nothing, which is the other half of being correct.
   */
  const extremes = {
    shape: 0.43,
    "eye.rx": 0.999,
    "eye.gap": 0.999,
    "eye.ratio": 0.999,
  };

  test("nothing is reported when the layout gave you what you asked for", () => {
    const t = reader(NAME, true, {});
    expect(resolved(blobLayout(NAME, {}, DEFAULT), t)).toEqual({});

    // Including the extremes, on a body with room for them.
    const round = { ...extremes, shape: 0.14 };
    expect(resolved(blobLayout(NAME, round, DEFAULT), reader(NAME, true, round))).toEqual({});
  });

  test("the biggest eyes and the widest gap come back short, and say so", () => {
    // The case ADR 0003 calls out: `fit` scales the eye cluster as a unit to
    // keep it inside the body, so both sliders stop moving near their tops.
    // Checked under both generations, because one readback serves both — gen2
    // reads `eye.rx` and `eye.gap` over the same ranges and clamps them against
    // a different region, which is exactly the kind of difference that could
    // have made this arithmetic wrong in one of them and not the other.
    for (const gen of GENS) {
      const t = reader(NAME, true, extremes);
      const ghosts = resolved(blobLayout(NAME, extremes, gen), t);

      expect(ghosts["eye.rx"]).toBeLessThan(0.999);
      expect(ghosts["eye.gap"]).toBeLessThan(0.999);
      for (const v of Object.values(ghosts)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the reported position is the one the blobatar was actually drawn at", () => {
    // The readback is arithmetic over the library's ranges, so it can drift
    // from them. This is what notices: pinning the *resolved* position has to
    // produce the same geometry, because at that value nothing needs clamping.
    for (const gen of GENS) {
      const t = reader(NAME, true, extremes);
      const ghosts = resolved(blobLayout(NAME, extremes, gen), t);
      const settled = blobLayout(NAME, { ...extremes, ...ghosts }, gen);
      const drawn = blobLayout(NAME, extremes, gen).eyes[0]!.rx;

      // Exact under gen1, whose clamp is stated in one axis: pinning the
      // resolved position is a fixed point of it. gen2 states the clamp in two
      // and it re-engages slightly on the smaller cluster, so the ghost is a
      // close approximation there rather than a fixed point — a few percent,
      // which is a fraction of a slider's width and still the right answer to
      // "why did this stop moving".
      expect(Math.abs(settled.eyes[0]!.rx - drawn) / drawn).toBeLessThan(gen === 1 ? 0.01 : 0.05);
    }
  });
});
