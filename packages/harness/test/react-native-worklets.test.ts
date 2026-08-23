/**
 * The worklet copy of the idle layer agrees with the original.
 *
 * `@blobatar/react-native/animated` runs its loops on the UI thread, and a
 * worklet cannot call an imported function: `react-native-worklets` moves a
 * function across by capturing its source and its closed-over values, so
 * anything it calls has to be in that source. The loops therefore exist twice,
 * in `blobatar/idle` and in the adapter's `src/worklets.ts`, which is the
 * duplication ADR-0009 is written to prevent everywhere else in this repo.
 *
 * This file is the price of the exception. It runs both versions over a sweep
 * of seeds, times and amplitudes and asserts they agree **exactly**, not
 * closely: they are the same arithmetic in the same order on the same inputs,
 * so any difference at all is a transcription error rather than a rounding one.
 *
 * That turns "keep these two in step" from a comment into a failing test, which
 * is the only form of that instruction anybody has ever followed. It runs on
 * the JS thread, because a worklet is a plain function until the plugin
 * rewrites it, so none of this needs a device.
 *
 * What it cannot prove is that the *plugin ran* on the published file. That is
 * asserted at build time instead: `packages/react-native/scripts/build.ts`
 * counts the worklets in `dist/animated.js` and fails if there are none, since
 * an untransformed directive is an ordinary function that silently runs on the
 * JS thread at the exact moment somebody is measuring whether the UI thread
 * helped.
 */

import { describe, expect, test } from "bun:test";
import { idleAt, idleSeeds, idleTransforms } from "blobatar/idle";
import { lerpPose, poseTransforms, _posed } from "blobatar/internal";
import { happy, mad, thinking } from "blobatar/expression";
import {
  bobT,
  breatheT,
  eyesT,
  glanceT,
  idleFrame,
  rockT,
  rootT,
} from "../../react-native/src/worklets";

/**
 * Imported by path rather than by package name, and deliberately.
 *
 * There is no `./worklets` subpath on `@blobatar/react-native` and there should
 * not be one: it is not API, it exists so this file can reach it. What the
 * published artifact needs proving about it is a different fact anyway, and one
 * a test cannot see, which is that the Babel plugin actually ran. That is
 * asserted by the build itself.
 */

const SEEDS = ["alain", "ada", "grace", "linus", "seed-7", "seed-42"];

/**
 * Times chosen to land on the awkward parts rather than uniformly.
 *
 * A uniform sweep spends almost all of its samples in the 97% of the blink
 * cycle where nothing happens, and almost none inside the 1.4% where it shuts.
 * The blink and the saccade's flicks are where a transcription error hides, so
 * the sweep is dense, wide, and deliberately includes the far end of the clock:
 * `timeSinceFirstFrame` on a long-lived screen is a large number, and a
 * `Math.floor` written one way rather than another only diverges out there.
 */
const TIMES = [
  0, 1, 7, 113, 449, 450, 451, 900, 1234, 2799, 2800, 2801, 3399, 3400,
  4711, 5600, 9999, 60_000, 3_600_000, 86_400_000,
];
for (let i = 0; i < 120; i++) TIMES.push(i * 41.7);

const AMPS = [0, 0.001, 0.25, 0.5, 0.75, 0.999, 1];
const SHAKES = [0, 0.35, 1];

describe("idleFrame is idleAt", () => {
  for (const name of SEEDS) {
    test(name, () => {
      const s = idleSeeds(name);
      for (const t of TIMES) {
        for (const amp of AMPS) {
          for (const shake of SHAKES) {
            expect(idleFrame(s, t, amp, shake), `${name} t=${t} amp=${amp} shake=${shake}`)
              .toEqual(idleAt(s, t, amp, shake));
          }
        }
      }
    });
  }

  test("a difference anywhere would actually be caught", () => {
    // The guard on the guard. `toEqual` on two objects of numbers is only a
    // real check if a wrong number fails it, and a comparison that quietly
    // passed on everything is exactly the shape this whole file could take
    // without anybody noticing.
    const s = idleSeeds("alain");
    expect(idleFrame(s, 1000, 1, 1)).not.toEqual(idleAt(s, 1001, 1, 1));
    expect(idleFrame(s, 1000, 1, 1)).not.toEqual(idleAt(s, 1000, 0.9, 1));
    expect(idleFrame(s, 1000, 1, 1)).not.toEqual(idleAt(s, 1000, 1, 0.9));
  });
});

/**
 * An SVG transform list, as the matrix `react-native-svg` would build from it.
 *
 * The worklets return a matrix rather than a string, because that is the only
 * transform a native `RNSVGGroup` has and a string written from the UI thread
 * is silently dropped. `worklets.ts` says why at length. What core composes is
 * still a string, so comparing the two means parsing one, and parsing it here
 * rather than importing `react-native-svg`'s parser is the point: an
 * independent reading of the string is a check, and the library's own reading
 * of it would only prove the two agree about `react-native-svg`.
 *
 * Handles `translate`, `scale` and `rotate`, which is every term either side
 * composes.
 */
function matrix(list: string): number[] {
  let m = [1, 0, 0, 1, 0, 0];
  const mul = (n: number[]) => {
    m = [
      m[0]! * n[0]! + m[2]! * n[1]!,
      m[1]! * n[0]! + m[3]! * n[1]!,
      m[0]! * n[2]! + m[2]! * n[3]!,
      m[1]! * n[2]! + m[3]! * n[3]!,
      m[0]! * n[4]! + m[2]! * n[5]! + m[4]!,
      m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
    ];
  };
  for (const [, fn, argv] of list.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = argv!.trim().split(/[\s,]+/).map(Number);
    if (fn === "translate") mul([1, 0, 0, 1, a[0]!, a[1] ?? 0]);
    else if (fn === "scale") mul([a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0]);
    else if (fn === "rotate") {
      const r = (a[0]! * Math.PI) / 180;
      mul([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
    } else throw new Error(`unhandled transform ${fn}`);
  }
  return m;
}

/**
 * Bit-identical is the wrong bar for a matrix and 0.001 is far too loose.
 *
 * The string path rounds each term to three decimals and then composes; the
 * worklet rounds the same terms to three decimals and composes the same
 * products in the same order. Only the float multiplications can differ, and
 * only in the last bits. A transcription error moves a term, not its mantissa.
 */
const near = (got: number[], want: number[], why: string) => {
  got.forEach((v, i) => {
    expect(Math.abs(v - want[i]!), `${why} [${i}]`).toBeLessThan(1e-9);
  });
};

describe("the transform parser reads what core writes", () => {
  test("the terms that appear in these strings", () => {
    expect(matrix("translate(3 -4)")).toEqual([1, 0, 0, 1, 3, -4]);
    expect(matrix("scale(2 3)")).toEqual([2, 0, 0, 3, 0, 0]);
    near(matrix("rotate(90)"), [0, 1, -1, 0, 0, 0], "rotate");
    // Order matters, and a parser that composed the other way would pass every
    // single-term case above.
    expect(matrix("translate(10 0) scale(2 2)")).toEqual([2, 0, 0, 2, 10, 0]);
    expect(matrix("scale(2 2) translate(10 0)")).toEqual([2, 0, 0, 2, 20, 0]);
  });
});

describe("the transforms compose the same picture", () => {
  // The adapter splits what core returns as one `eye` transform into two
  // groups: the pose, computed in JavaScript at `rockp: 1`, and the seesaw's
  // difference from it as an outer translate. That is the one place the two
  // sides are *not* transcriptions of each other, so it is the one that most
  // needs checking: the split has to multiply back out to what core composes.
  for (const [label, expression] of [
    ["idle", undefined],
    ["happy", happy],
    ["mad", mad],
    ["thinking", thinking],
  ] as const) {
    test(label, () => {
      for (const name of SEEDS) {
        const s = idleSeeds(name);
        const f = _posed(name, expression ? { expression } : {});
        const l = { eyes: f.eyeFrames };
        // `undefined` is idle, which is the identity pose. `lerpPose` is how
        // the rest of the library spells that, so it is how this does too.
        const p = lerpPose(f.pose, f.pose, 1);

        for (const t of [0, 225, 450, 675, 900, 1234, 4711]) {
          const frame = idleAt(s, t, 1, p.shake);
          const core = idleTransforms(l, p, frame);

          near(rootT(frame), matrix(core.root), `${label} ${name} root`);
          near(breatheT(frame), matrix(core.breathe), `${label} ${name} breathe`);
          near(bobT(frame, p.bdy), matrix(core.bob), `${label} ${name} bob`);
          near(eyesT(frame), matrix(core.eyes), `${label} ${name} eyes`);

          l.eyes.forEach((e, i) => {
            near(
              glanceT(frame, e.cx, e.cy, e.rot, i ? 1 : -1),
              matrix(core.glance[i]!),
              `${label} ${name} glance ${i}`,
            );
          });
        }
      }
    });
  }

  test("a difference anywhere would actually be caught", () => {
    // The guard on the guard, matching the one above `idleFrame`. `near` at
    // 1e-9 is only a real check if a genuinely different matrix fails it, and
    // the two eyes' glances differ by exactly the kind of sign flip a
    // transcription error makes.
    const f = _posed("alain", { expression: thinking });
    const s = idleSeeds("alain");
    const frame = idleAt(s, 450, 1, f.pose!.shake);
    const [l, r] = f.eyeFrames;
    expect(() =>
      near(
        glanceT(frame, l!.cx, l!.cy, l!.rot, -1),
        glanceT(frame, r!.cx, r!.cy, r!.rot, 1),
        "opposite eyes",
      ),
    ).toThrow();
  });

  test("the seesaw split lands where core puts it", () => {
    // `poseTransforms(l, p, rockp)` in core, against `poseTransforms(l, p)`
    // plus the adapter's outer translate. `thinking` is the only pose in the
    // roster that rocks, so it is the only one where these two can differ, and
    // the identity has to hold at every phase rather than only at the ends.
    const f = _posed("alain", { expression: thinking });
    const l = { eyes: f.eyeFrames };
    const p = f.pose!;
    const s = idleSeeds("alain");

    for (const t of [0, 100, 225, 450, 600, 899, 900]) {
      const frame = idleAt(s, t, 1, p.shake);
      const merged = poseTransforms(l, p, frame.rockp).eyes;
      const base = poseTransforms(l, p).eyes;
      l.eyes.forEach((_, i) => {
        // The adapter draws `rockT` outside `base`; core folds the phase in.
        // Both are `translate(0 d) · translate(cx cy) · …`, so the composed
        // vertical offset is what has to match.
        const d = rockT(frame, p, i ? 1 : -1)[5];
        const y = Number(base[i]!.match(/^translate\([-\d.]+ (-?[\d.]+)\)/)![1]);
        const want = Number(merged[i]!.match(/^translate\([-\d.]+ (-?[\d.]+)\)/)![1]);
        // Within one rounding step, and not closer, which is the honest bound
        // rather than a loosened one. Core rounds the merged offset once; the
        // adapter rounds the pose and the seesaw separately and the renderer
        // adds them, so the two can differ by the last digit `r3` keeps. That
        // is 0.001 of a viewBox unit, or about a hundred-thousandth of the
        // figure. Anything larger is a composition error rather than rounding,
        // which is what this bound is set to catch.
        expect(Math.abs(y + d - want), `phase ${t} eye ${i}`).toBeLessThanOrEqual(0.0011);
      });
    }
  });
});
