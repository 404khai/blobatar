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

          expect(rootT(frame), `${label} ${name} root`).toBe(core.root);
          expect(breatheT(frame), `${label} ${name} breathe`).toBe(core.breathe);
          expect(bobT(frame, p.bdy), `${label} ${name} bob`).toBe(core.bob);
          expect(eyesT(frame), `${label} ${name} eyes`).toBe(core.eyes);

          l.eyes.forEach((e, i) => {
            expect(glanceT(frame, e.cx, e.cy, e.rot, i ? 1 : -1), `${label} ${name} glance`)
              .toBe(core.glance[i]!);
          });
        }
      }
    });
  }

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
        const d = Number(rockT(frame, p, i ? 1 : -1).match(/-?[\d.]+(?=\))/)![0]);
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
