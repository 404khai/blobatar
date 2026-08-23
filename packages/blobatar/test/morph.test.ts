/**
 * The morph agrees with the bake, at every pose.
 *
 * This is the cheap version of `scripts/probe-compose.ts` and it is here for
 * the same reason that file exists: there are two renderings of one pose
 * composition, and the gap between them is where two shipped bugs lived. The
 * probe measures the CSS against `bakePose` in headless Chrome, because CSS is
 * only true in a browser. `poseTransforms` is arithmetic, so the same question
 * is answerable in Bun in a second, with no device and no browser, over a far
 * wider sweep than a probe can afford.
 *
 * The oracle is one sentence: **at any frozen pose, the geometry an animated
 * blobatar renders must equal the geometry the static one bakes.** If the
 * channels-to-transforms mapping is wrong anywhere, that catches it everywhere
 * at once, which is the property that makes it worth writing before the
 * adapter rather than after it.
 *
 * It compares *points*, not transform strings, because the two paths are not
 * meant to be spelled the same: one welds the pose into coordinates and the
 * other carries it as a matrix. So the transform list is parsed back to a
 * matrix, applied to the drawn path, and the resulting points are what have to
 * match the baked path's.
 */

import { describe, expect, test } from "bun:test";
import { _marks, _posed } from "../src/blobatar";
import { fadeHex } from "../src/color";
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
  type Expression,
} from "../src/expression";
import { bakePose, lerpPose, poseTransforms } from "../src/morph";
import { superellipse } from "../src/shape";
import { style } from "../src/styles/blob";
import { traits } from "../src/traits";
import type { Layout } from "../src/styles/compose";

const NAMED: [string, Expression][] = [
  ["idle", idle],
  ["happy", happy],
  ["sad", sad],
  ["mad", mad],
  ["surprised", surprised],
  ["wink", wink],
  ["sleepy", sleepy],
  ["smug", smug],
  ["unsure", unsure],
  ["scared", scared],
  ["love", love],
  ["shy", shy],
  ["sick", sick],
  ["thinking", thinking],
];

/**
 * Fewer seeds than `expression.test.ts` sweeps, and deliberately so. That file
 * is looking for the one seed-and-pose pair that breaks containment, which is a
 * needle and needs the haystack. This one is checking an algebraic identity: if
 * it holds for a leaned eye at a loud pose it holds for all of them, and what
 * the seeds buy here is coverage of the *lean*, which is the term the identity
 * turns on. 400 spans the full seeded range several times over.
 */
const SEEDS = Array.from({ length: 400 }, (_, i) => `morph-${i}`);

/** A 2×3 affine matrix, in SVG's own column order: [a b c d e f]. */
type M = [number, number, number, number, number, number];

const I: M = [1, 0, 0, 1, 0, 0];

const times = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * An SVG transform list, as a matrix.
 *
 * Only the three functions `poseTransforms` emits are understood, and an
 * unknown one throws rather than being skipped: a silently ignored term is
 * exactly the failure this whole file exists to catch, and it would make every
 * assertion below pass while the picture was wrong.
 */
function parse(list: string): M {
  let m = I;
  for (const [, fn, args] of list.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)) {
    const n = args!.trim().split(/[\s,]+/).map(Number);
    if (fn === "translate") m = times(m, [1, 0, 0, 1, n[0]!, n[1] ?? 0]);
    else if (fn === "scale") m = times(m, [n[0]!, 0, 0, n[1] ?? n[0]!, 0, 0]);
    else if (fn === "rotate") {
      const t = (n[0]! * Math.PI) / 180;
      m = times(m, [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0]);
    } else throw new Error(`unhandled transform function: ${fn}`);
  }
  return m;
}

/** Every coordinate pair in a path, in order. */
const points = (d: string): [number, number][] => {
  const n = d.match(/-?\d+\.?\d*/g)!.map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
};

/**
 * A mark's path data, insisting that it has some.
 *
 * Every eye is a `superellipse` and so a path, and `_posed` narrows its `eyes`
 * to that. The static side comes back as the wider `Mark`, so the claim is
 * made here rather than cast away: a circle reaching this comparison would mean
 * the two renderers disagree about what an eye *is*, which is worth an error
 * and not a skipped assertion.
 */
const path = (m: { kind: string; d?: string }): string => {
  if (m.kind !== "path" || !m.d) throw new Error(`not a path: ${m.kind}`);
  return m.d;
};

const apply = (m: M, [x, y]: [number, number]): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

test("the transform parser refuses what it does not understand", () => {
  // The guard on the guard. A term this reader skipped rather than rejected
  // would make every assertion in this file pass against a picture that was
  // wrong, and the first version of it did exactly that: the function-name
  // pattern was lowercase-only, so `skewX` matched nothing and was silently an
  // identity.
  expect(() => parse("skewX(4)")).toThrow();
  expect(() => parse("matrix(1 0 0 1 0 0)")).toThrow();
  expect(parse("translate(2 3)")).toEqual([1, 0, 0, 1, 2, 3]);
});

describe("the animated path draws what the static one bakes", () => {
  for (const [label, e] of NAMED) {
    test(`${label}: every eye lands where bakePose puts it`, () => {
      for (const seed of SEEDS) {
        const l = style.layout(traits(seed, true)) as Layout;
        const moved = poseTransforms(l, e.p);
        const baked = bakePose(l, e.p);

        for (let i = 0; i < l.eyes.length; i++) {
          const m = parse(moved.eyes[i]!);
          const drawn = points(superellipse(l.eyes[i]!)).map(p => apply(m, p));
          const want = points(superellipse(baked.l.eyes[i]!));

          expect(drawn.length).toBe(want.length);
          for (let k = 0; k < want.length; k++) {
            // A hundredth of a viewBox unit, which is what `superellipse`
            // rounds to. The two paths cannot be bit-identical: the baked one
            // rounds after composing and this one rounds before, so the
            // transform carries the rounding error of the drawn coordinates
            // through a scale. On the loudest pose in the roster that scale is
            // under 11, so the error stays inside a rounding step of the same
            // size the renderer itself introduces.
            expect(drawn[k]![0]).toBeCloseTo(want[k]![0], 1);
            expect(drawn[k]![1]).toBeCloseTo(want[k]![1], 1);
          }
        }
      }
    });
  }

  test("the body wrap is the same translate, spelled unconditionally", () => {
    for (const [label, e] of NAMED) {
      const l = style.layout(traits("wrap", true)) as Layout;
      const moved = poseTransforms(l, e.p).wrap;
      const baked = bakePose(l, e.p).wrap;
      // `bakePose` emits nothing at all for a pose that does not shift the
      // body, because a static renderer that wraps in an identity `<g>` pays
      // for a node it does not need. A morph cannot make that saving: `bdy`
      // passes through nonzero between two poses that both sit at zero, and a
      // group that appears mid-transition is a reparent rather than a
      // translate. So they agree on the number and differ on whether the
      // identity is written down, and this states which is which.
      expect(parse(moved), label).toEqual(parse(baked || "translate(0 0)"));
    }
  });
});

describe("_posed hands back the figure before the pose", () => {
  test("the eyes are the tail of what marks() draws", () => {
    // `_posed` splits the mark list by counting back from the end, which is
    // only correct while `marks()` keeps drawing the eyes last. Asserted here
    // rather than left as a comment two files apart, since the failure it
    // guards against is silent: the split would still return two lists, and the
    // wrong marks would get the eye transforms.
    for (const seed of SEEDS.slice(0, 40)) {
      const f = _posed(seed);
      const l = style.layout(traits(seed, true)) as Layout;
      expect(f.eyes.length).toBe(l.eyes.length);
      for (const m of f.eyes) expect(m.kind).toBe("path");
      // Same figure as the static one, same order, once the two halves are
      // put back together.
      expect([...f.marks, ...f.eyes].map(m => m.kind)).toEqual(
        _marks(seed).marks.map(m => m.kind),
      );
    }
  });

  test("with no expression it is the static figure exactly", () => {
    // The identity case, and the one that makes the oracle above meaningful:
    // an unbaked figure at the identity pose has to already be what `_marks`
    // draws, or the two are measuring different blobatars.
    for (const seed of SEEDS.slice(0, 40)) {
      const f = _posed(seed);
      expect([...f.marks, ...f.eyes]).toEqual(_marks(seed).marks);
      expect(f.bg).toEqual(_marks(seed).bg);
      expect(f.pose).toBeUndefined();
      expect(f.hot).toBeNull();
    }
  });

  test("a frozen morph draws the static blobatar, marks and fills alike", () => {
    // The oracle as an adapter would assemble it, rather than as arithmetic:
    // take the unbaked figure, drive it to t = 1, and it has to be the posed
    // static one down to the fill. This is what `packages/harness` asserts
    // through the real React Native stub, checked here first so a failure
    // points at core rather than at an adapter.
    for (const [label, e] of NAMED) {
      for (const seed of SEEDS.slice(0, 25)) {
        const f = _posed(seed, { expression: e });
        const at = lerpPose(undefined, f.pose, 1);
        const t = poseTransforms({ eyes: f.eyeFrames }, at);
        const want = _marks(seed, { expression: e });

        // At t = 1 the fill *is* `hot`, with no mix left to do, and that is the
        // whole reason `hot` is a finished colour rather than a target: `heat`
        // has already been spent picking it. What the morph travels is the
        // distance from the base fill to that endpoint, on the morph's own
        // progress, exactly as `transition: fill` does on the web, which is
        // why `at.heat` appears nowhere here.
        const eye = f.hot ? fadeHex(f.fill.eye, f.hot.eye, 1) : f.fill.eye;
        const head = f.hot ? fadeHex(f.fill.head, f.hot.head, 1) : f.fill.head;

        const cut = want.marks.length - f.eyes.length;
        const wantBody = want.marks.slice(0, cut);
        const wantEyes = want.marks.slice(cut);

        // Fills first, because a colour failure and a geometry failure read
        // identically once they are both "the blobatar looks wrong".
        //
        // Two claims, and they are different ones. The unbaked figure starts at
        // the *base* palette, tinting pose or not, because that is where the
        // travel begins; and the far end of that travel is what the static
        // renderer paints. A `_posed` that handed back pre-tinted fills would
        // pass the second and fail the first, and would make every hot pose pop
        // to full red on the frame the expression was set.
        for (const m of f.marks) expect(m.fill, label).toBe(f.fill.head);
        for (const m of f.eyes) expect(m.fill, label).toBe(f.fill.eye);
        for (const m of wantBody) expect(m.fill, label).toBe(head);
        for (const m of wantEyes) expect(m.fill, label).toBe(eye);

        // …then the geometry, through the transforms rather than through the
        // bake, which is the path the adapter is actually on.
        for (let i = 0; i < f.eyes.length; i++) {
          const m = parse(t.eyes[i]!);
          const drawn = points(path(f.eyes[i]!)).map(p => apply(m, p));
          const target = points(path(wantEyes[i]!));
          for (let k = 0; k < target.length; k++) {
            expect(drawn[k]![0]).toBeCloseTo(target[k]![0], 1);
            expect(drawn[k]![1]).toBeCloseTo(target[k]![1], 1);
          }
        }
        expect(parse(t.wrap), label).toEqual(parse(want.transform || "translate(0 0)"));
      }
    }
  });
});

describe("lerpPose", () => {
  test("the ends are the ends", () => {
    for (const [label, e] of NAMED) {
      expect(lerpPose(idle.p, e.p, 0), label).toEqual(idle.p);
      expect(lerpPose(idle.p, e.p, 1), label).toEqual(e.p);
    }
  });

  test("undefined is idle, on either end", () => {
    // The same claim `poseVars` makes by emitting nothing for `idle`: the
    // identity is not a pose a caller should have to import in order to morph
    // away from an expression.
    expect(lerpPose(undefined, mad.p, 1)).toEqual(mad.p);
    expect(lerpPose(mad.p, undefined, 1)).toEqual(idle.p);
    expect(lerpPose(undefined, undefined, 0.5)).toEqual(idle.p);
  });

  test("every channel moves, and none of them jumps", () => {
    // Thirteen channels plus `heat`, and a loop that misses one is invisible
    // until somebody looks at a face mid-morph. `mad` moves all of them.
    const half = lerpPose(idle.p, mad.p, 0.5) as unknown as Record<string, number>;
    const a = idle.p as unknown as Record<string, number>;
    const b = mad.p as unknown as Record<string, number>;
    for (const k of Object.keys(a)) {
      expect(half[k], k).toBeCloseTo((a[k]! + b[k]!) / 2, 10);
    }
    expect(Object.keys(half).sort()).toEqual(Object.keys(a).sort());
  });

  test("heat is walked even though nothing reads it", () => {
    // It reaches no transform: the fill travels between two finished colours on
    // the morph's own progress, so `heat` is spent before a frame is drawn.
    // Walked anyway, because a `Pose` with one channel quietly frozen at the
    // target is a struct that no longer means what it says.
    expect(lerpPose(idle.p, mad.p, 0.5).heat).toBeCloseTo(mad.p.heat / 2, 10);
  });
});

describe("fadeHex", () => {
  test("the ends are the ends", () => {
    expect(fadeHex("#123456", "#abcdef", 0)).toBe("#123456");
    expect(fadeHex("#123456", "#abcdef", 1)).toBe("#abcdef");
  });

  test("it travels in sRGB, which is where transition: fill travels", () => {
    // Half way between black and white is 0x80, not the perceptual middle
    // grey a `mix` in OKLab would give. That is the point of it existing next
    // to `mixHex` rather than instead of it. See its header.
    expect(fadeHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  test("it stays a well-formed hex colour across the walk", () => {
    for (let i = 0; i <= 20; i++) {
      const v = fadeHex("#050a0f", "#f0fa05", i / 20);
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
