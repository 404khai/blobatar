/**
 * The gaze's pure core: the pursuit filter, the write threshold, and the
 * spherical projection §4.5 aims the eyes with.
 *
 * Everything here is arithmetic. The driver around it needs a DOM and a frame
 * clock and is covered by `scripts/smoke.mjs` and the probe; nothing in this
 * file touches either, which is the property that lets `apps/video` solve a
 * whole track at module load.
 */
import { test, expect, describe } from "bun:test";
import {
  DEADZONE,
  LIMB,
  HOLD_EPS,
  SETTLE,
  SNAP,
  TILT,
  project,
  pursuit,
  smoothstep,
  step,
  threshold,
} from "../src/gaze";

/** The hero's own geometry, so the numbers here are a face that exists. */
const EYE = { x: (63.3 - 48.84) / 33.57, y: (48.05 - 51.21) / 33.57 };

describe("pursuit", () => {
  test("covers ~63% of the way in one time constant", () => {
    expect(pursuit(SETTLE)).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  test("is frame-rate independent: two 8ms steps land where one 16ms step does", () => {
    const one = pursuit(16);
    const half = pursuit(8);
    expect(1 - (1 - half) * (1 - half)).toBeCloseTo(one, 12);
  });

  test("a zero settle is a snap rather than a division by zero", () => {
    expect(pursuit(16, 0)).toBe(1);
  });
});

describe("threshold", () => {
  test("a wider blobatar at the same excursion needs a finer threshold", () => {
    expect(threshold(400, 3)).toBeLessThan(threshold(100, 3));
  });

  test("clamped at both ends, so a tiny cell never quantises the direction", () => {
    expect(threshold(24, 0.1)).toBeLessThanOrEqual(0.06);
    expect(threshold(4000, 40)).toBeGreaterThanOrEqual(0.002);
  });

  test("no excursion is the coarsest threshold, not an infinite one", () => {
    expect(threshold(200, 0)).toBe(0.06);
    expect(Number.isFinite(threshold(200, 0))).toBe(true);
  });
});

describe("step", () => {
  const base = { x: 0, y: 0, radius: 100, k: 1 };

  test("aims at the target, normalised", () => {
    const s = step({ ...base, dx: 300, dy: 0 });
    expect(s.tx).toBeCloseTo(1, 6);
    expect(s.ty).toBeCloseTo(0, 6);
  });

  test("the near field eases the amplitude to zero, not the direction", () => {
    const on = step({ ...base, dx: 0.001, dy: 0 });
    expect(Math.hypot(on.tx, on.ty)).toBeLessThan(0.001);
  });

  test("pointing straight at a face makes it look straight back", () => {
    const s = step({ ...base, dx: 0, dy: 0 });
    expect(s.tx).toBe(0);
    expect(s.ty).toBe(0);
  });

  test("the near field is a fraction of the blobatar's own radius", () => {
    const d = 100 * DEADZONE * 0.5;
    const small = step({ ...base, radius: 100, dx: d, dy: 0 });
    const large = step({ ...base, radius: 400, dx: d, dy: 0 });
    expect(large.tx).toBeLessThan(small.tx);
  });

  test("a target that moves at pursuit speed is pursued", () => {
    const s = step({ ...base, x: 0.9, y: 0, dx: 300, dy: 0, k: 0.2 });
    expect(s.f).toBe(0.2);
  });

  test("a target that is replaced rather than moved is jumped to", () => {
    const s = step({ ...base, x: -1, y: 0, dx: 300, dy: 0, k: 0.2 });
    expect(Math.hypot(s.tx + 1, s.ty)).toBeGreaterThan(SNAP);
    expect(s.f).toBe(1);
  });

  test("gain scales the excursion without touching the aim", () => {
    const full = step({ ...base, dx: 300, dy: 0 });
    const half = step({ ...base, dx: 300, dy: 0, gain: 0.5 });
    expect(half.tx).toBeCloseTo(full.tx * 0.5, 6);
  });

  test("it converges, and without overshooting", () => {
    /* From rest rather than from a full reversal, which `SNAP` would answer
       with one jump and nothing to watch converge. */
    let s = { x: 0, y: 0 } as { x: number; y: number };
    let prev = -Infinity;
    for (let i = 0; i < 60; i++) {
      s = step({ ...base, x: s.x, y: s.y, dx: 300, dy: 0, k: 0.2 });
      expect(s.x).toBeGreaterThanOrEqual(prev);
      expect(s.x).toBeLessThanOrEqual(1);
      prev = s.x;
    }
    expect(s.x).toBeCloseTo(1, 3);
  });

  test("a zero radius is a blobatar not yet laid out, not a NaN", () => {
    const s = step({ ...base, radius: 0, dx: 10, dy: 0 });
    expect(Number.isFinite(s.x)).toBe(true);
    expect(s.tx).toBeCloseTo(1, 6);
  });
});

describe("project — the eyes as marks on a sphere", () => {
  test("no turn is the identity on every mark, wherever it rests", () => {
    for (const m of [EYE, { x: 0, y: 0 }, { x: -0.6, y: 0.4 }]) {
      const p = project(m, 0, 0);
      expect(p.dx).toBeCloseTo(0, 12);
      expect(p.dy).toBeCloseTo(0, 12);
      expect(p.sx).toBeCloseTo(1, 12);
      expect(p.sy).toBeCloseTo(1, 12);
      expect(p.t).toBeCloseTo(0, 12);
    }
  });

  test("it moves the way the aim points, on both axes", () => {
    /*
     * The one that a rewrite gets wrong silently. `project` rotates a vector,
     * and the textbook rotation about X is right-handed — but SVG's y grows
     * *downward*, so writing it that way inverts the vertical and a pointer
     * below the face makes it look up. Nothing else in the suite can see that:
     * every containment and foreshortening property holds just as well upside
     * down.
     */
    const m = { x: 0, y: 0 };
    expect(project(m, 0.3, 0).dx).toBeGreaterThan(0);
    expect(project(m, -0.3, 0).dx).toBeLessThan(0);
    /* Down the screen is +y, so an aim below the face moves the eye down. */
    expect(project(m, 0, 0.3).dy).toBeGreaterThan(0);
    expect(project(m, 0, -0.3).dy).toBeLessThan(0);
    /* And a diagonal does both at once rather than one of them. */
    const d = project(m, 0.3, 0.3);
    expect(d.dx).toBeGreaterThan(0);
    expect(d.dy).toBeGreaterThan(0);
  });

  test("an eye off centre still moves the way the aim points", () => {
    for (const m of [EYE, { x: -EYE.x, y: EYE.y }, { x: 0.5, y: 0.5 }, { x: -0.5, y: -0.5 }]) {
      expect(project(m, 0.2, 0).dx).toBeGreaterThan(0);
      expect(project(m, 0, 0.2).dy).toBeGreaterThan(0);
      expect(project(m, -0.2, 0).dx).toBeLessThan(0);
      expect(project(m, 0, -0.2).dy).toBeLessThan(0);
    }
  });

  test("a mark at the centre of the face moves exactly the excursion", () => {
    /* Which is what `travel` means: the arc swept at the middle of the face.
       The documented range, on a face of the hero's radius. */
    const turn = 3 / 33.57;
    const p = project({ x: 0, y: 0 }, turn, 0);
    expect(Math.abs(p.dx - turn) / turn).toBeLessThan(0.002);
  });

  test("and an eye off the centre meridian moves cos of its own longitude less", () => {
    /* Not a discrepancy: a mark nearer the limb covers less screen for the same
       head turn, which is the differential the whole layer exists to show. It
       is 10% on the hero's eye spacing, and it is why the excursion is defined
       at the centre rather than at the eyes. */
    const tiny = 1e-5;
    /* The rate is the mark's *depth*, `√(1 − x² − y²)`, not the cosine of its
       longitude alone: a rotation of the real vector knows about both axes,
       where two independent angles did not. */
    const depth = Math.sqrt(1 - EYE.x * EYE.x - EYE.y * EYE.y);
    expect(project(EYE, tiny, 0).dx / tiny).toBeCloseTo(depth, 4);
    /* At the documented excursion the second-order term has arrived too, so the
       eye is a little short of even that: 88% rather than 90%. */
    const turn = 3 / 33.57;
    expect(project(EYE, turn, 0).dx / turn).toBeCloseTo(0.88, 2);
  });

  test("the excursion saturates: a mark cannot pass the limb", () => {
    for (const turn of [0.1, 1, 10, 1000]) {
      const p = project(EYE, turn, 0);
      expect(EYE.x + p.dx).toBeLessThanOrEqual(1);
    }
  });

  test("and it arrives there at no width, so nothing has to clip it", () => {
    /* Swept to the limb rather than jumped past it: a large enough turn carries
       the mark round the back, where it is not drawn at all, and the frame that
       matters is the one where it reaches the edge. */
    let thinnest = 1;
    for (let a = 0; a < Math.PI / 2; a += 0.005) {
      thinnest = Math.min(thinnest, project(EYE, a, 0).sx);
    }
    /* A quarter of its width at the parking line, which is what `LIMB` trades
       for never letting the eye disappear entirely. */
    expect(thinnest).toBeLessThan(0.3);
  });

  test("a mark is parked at the edge rather than carried round the back", () => {
    /*
     * The excursion is a stylesheet's to set and nothing stops it being set to
     * more head than there is. `triangle`'s fitted head is 9 units tall, so an
     * excursion of 24 is a pitch of 159° — and an eye that rotates out of sight
     * because someone typed a large number reads as the face breaking, not as
     * the face turning away.
     */
    for (const turn of [Math.PI / 2, Math.PI, 4, 40]) {
      for (const [a, b] of [[turn, 0], [0, turn], [turn, turn], [-turn, turn]]) {
        const p = project(EYE, a!, b!);
        expect(Math.hypot(EYE.x + p.dx, EYE.y + p.dy)).toBeLessThanOrEqual(LIMB + 1e-9);
        /* Still something on screen, on both axes. */
        expect(p.sx).toBeGreaterThan(0.05);
        expect(p.sy).toBeGreaterThan(0.05);
      }
    }
  });

  test("and it slides along the edge continuously rather than jumping there", () => {
    let prev = project(EYE, 0, 0);
    for (let a = 0; a < 3; a += 0.01) {
      const p = project(EYE, a, a * 0.6);
      expect(Math.hypot(p.dx - prev.dx, p.dy - prev.dy)).toBeLessThan(0.03);
      expect(Math.abs(p.sx - prev.sx)).toBeLessThan(0.03);
      prev = p;
    }
  });

  test("no aim, on any diagonal, can take a mark off the disc", () => {
    /*
     * The corner case, literally. Two angles clamped one per axis is a square,
     * not a sphere: a diagonal aim drove both to their limits at once and put
     * the mark at `(1, 1)`, which is √2 out on a disc of radius 1. The eye left
     * the head on every diagonal while behaving perfectly on the axes, which is
     * exactly what it looked like.
     */
    for (const m of [EYE, { x: -EYE.x, y: EYE.y }, { x: 0.6, y: 0.6 }, { x: 0, y: 0 }])
      for (let a = 0; a < 360; a += 5) {
        const r = (a * Math.PI) / 180;
        for (const turn of [0.09, 0.7, 3, 40]) {
          const p = project(m, Math.cos(r) * turn, Math.sin(r) * turn);
          expect(Math.hypot(m.x + p.dx, m.y + p.dy)).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
  });

  test("foreshortening never grows a mark, which is the tell that breaks it", () => {
    for (let x = -1; x <= 1; x += 0.05) {
      for (let y = -1; y <= 1; y += 0.05) {
        const p = project(EYE, x * 0.5, y * 0.5);
        /* Including the direction that un-foreshortens: turning toward the
           centre meridian is where the honest geometry would widen the eye. */
        expect(p.sx).toBeLessThanOrEqual(1 + 1e-9);
        expect(p.sy).toBeLessThanOrEqual(1 + 1e-9);
        expect(p.sx).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("the leading eye compresses harder than the trailing one, with no coefficient saying so", () => {
    const right = { x: EYE.x, y: EYE.y };
    const left = { x: -EYE.x, y: EYE.y };
    const turn = 4 / 33.57;
    /* Looking right: the right eye is the one riding toward the limb. */
    expect(project(right, turn, 0).sx).toBeLessThan(project(left, turn, 0).sx);
    /* And the differential reverses with the glance rather than being fixed. */
    expect(project(left, -turn, 0).sx).toBeLessThan(project(right, -turn, 0).sx);
  });

  test("the tilt is a convergence, opposite per eye rather than a shared roll", () => {
    const right = { x: EYE.x, y: EYE.y };
    const left = { x: -EYE.x, y: EYE.y };
    expect(project(right, 0.35, 0.35).t * project(left, 0.35, 0.35).t).toBeLessThan(0);
  });

  test("and it vanishes on the pure axes for a mark on the equator, as §4.7 has it", () => {
    const eq = { x: EYE.x, y: 0 };
    expect(project(eq, 0.5, 0).t).toBeCloseTo(0, 12);
    expect(project({ x: 0, y: EYE.y }, 0, 0.5).t).toBeCloseTo(0, 12);
  });

  test("the tilt stays well under the 12° lean that carries identity", () => {
    let peak = 0;
    for (let x = -1; x <= 1; x += 0.05)
      for (let y = -1; y <= 1; y += 0.05)
        for (const turn of [4 / 33.57, 0.5, 1000])
          peak = Math.max(peak, Math.abs(project(EYE, x * turn, y * turn).t));
    /* Reported rather than merely bounded: this is the number motion-spec.md
       quotes, and a retune that moves it should fail here and be written down
       rather than pass quietly. */
    expect(peak).toBeLessThan(12);
    expect(peak).toBeCloseTo(1.6, 1);
  });

  test("it is finite everywhere, including at a mark already on the limb", () => {
    for (const m of [{ x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 0 }])
      for (const turn of [0, 1, 1e6]) {
        const p = project(m, turn, -turn);
        for (const v of [p.dx, p.dy, p.sx, p.sy, p.t]) expect(Number.isFinite(v)).toBe(true);
      }
  });
});

describe("the constants the layer is tuned against", () => {
  test("the near field is inside the blobatar, and the snap is under a full reversal", () => {
    expect(DEADZONE).toBeGreaterThan(0);
    expect(DEADZONE).toBeLessThan(1);
    expect(SNAP).toBeLessThan(2);
  });

  test("the stand-down is coarser than the excursion's finest threshold", () => {
    expect(HOLD_EPS).toBeGreaterThan(0.002);
  });

  test("smoothstep is flat at both ends", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
  });
});

/**
 * `gaze.css` restates three of `motion.css`'s declarations, because §4.8 has no
 * free transform property left to land on. Restating one at the *same*
 * specificity makes the cascade decide on source order — and source order is
 * not import order, it is whatever order a bundler emits two stylesheets in.
 *
 * This is not hypothetical. `apps/site` imports `motion.css` first and
 * `gaze.css` second, and the built page links them the other way round, which
 * made every overridden declaration lose: the driver ran, the properties were
 * written, and the eyes did not move. Nothing in the suite could see it,
 * because every other gate loads the two files in one controlled order.
 *
 * So the rule is checked against the text rather than against a rendering: any
 * selector this file shares with `motion.css` must be more specific than
 * `motion.css`'s, and then the order it lands in cannot matter.
 */
describe("gaze.css against motion.css", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  /** Every rule's selector and the properties it declares, blocks flattened. */
  const rules = (css: string) => {
    const out: { sel: string; props: Set<string> }[] = [];
    const re = /([^{}@]+)\{([^{}]*)\}/g;
    for (const m of strip(css).matchAll(re)) {
      const sel = m[1]!.trim().replace(/\s+/g, " ");
      if (!sel || sel.startsWith("@") || sel.includes("%")) continue;
      const props = new Set(
        [...m[2]!.matchAll(/(^|;)\s*([a-z-]+)\s*:/g)].map((d) => d[2]!),
      );
      out.push({ sel, props });
    }
    return out;
  };

  /** Class count is enough here: neither file uses an id or an element name. */
  const rank = (sel: string) => (sel.match(/\./g) ?? []).length;

  test("every selector it shares with motion.css is more specific", async () => {
    const motion = rules(await Bun.file(`${import.meta.dir}/../src/motion.css`).text());
    const gaze = rules(await Bun.file(`${import.meta.dir}/../src/gaze.css`).text());

    for (const g of gaze) {
      for (const m of motion) {
        const clash = [...g.props].filter((p) => m.props.has(p));
        if (!clash.length) continue;
        /* Only a selector that can match the same element is a collision, and
           an identical one certainly can. */
        if (m.sel !== g.sel && !g.sel.endsWith(` ${m.sel}`)) continue;
        /* Named in the failure, because "2 is not greater than 2" on its own
           says nothing about which declaration just went silent. */
        expect({
          clash: `${g.sel} restates ${clash.join(", ")} from ${m.sel}`,
          moreSpecific: rank(g.sel) > rank(m.sel),
        }).toEqual({
          clash: `${g.sel} restates ${clash.join(", ")} from ${m.sel}`,
          moreSpecific: true,
        });
      }
    }
  });

  test("and it does restate the three §4.8 has nowhere else to go", async () => {
    const gaze = rules(await Bun.file(`${import.meta.dir}/../src/gaze.css`).text());
    const eye = gaze.find((r) => r.sel.endsWith(".mo-eye"))!;
    expect(eye).toBeDefined();
    for (const p of ["translate", "rotate", "transform"]) expect(eye.props.has(p)).toBe(true);
    expect(rank(eye.sel)).toBeGreaterThan(1);
  });
});
