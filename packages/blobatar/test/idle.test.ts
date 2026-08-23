/**
 * The idle layer as arithmetic, checked against what the stylesheet claims.
 *
 * This file cannot see a browser, so it cannot prove the port is faithful.
 * `scripts/probe-idle.ts` does that, by freezing the real stylesheet at sampled
 * times in headless Chrome and comparing matrices. What this proves is
 * everything that is true of the model on its own terms, and there is more of
 * it than there looks: amplitudes, periods, the hold-and-flick shape of the
 * saccade, the blink firing once per cycle, and the property the whole crowd
 * rests on, which is that two seeds are not in step.
 *
 * The one check here that ties this file to a verified thing rather than to
 * itself is the last: at rest, an animated blobatar's composition has to be the
 * still one's, transform for transform. `test/morph.test.ts` already holds that
 * against `bakePose`, so anything reached through it is anchored.
 */

import { describe, expect, test } from "bun:test";
import { motionSeeds } from "../src/animate";
import { idleAt, idleTransforms } from "../src/idle";
import { happy, mad, thinking } from "../src/expression";
import { idle } from "../src/expression";
import { poseTransforms } from "../src/morph";
import { style } from "../src/styles/blob";
import { traits } from "../src/traits";
import type { Layout } from "../src/styles/compose";

const seeds = (name: string) => motionSeeds(traits(name, true));
const layout = (name: string) => style.layout(traits(name, true)) as Layout;

const S = seeds("alain");

/** A whole cycle of something, sampled fine enough to catch a flick. */
const sweep = (period: number, n = 400) =>
  Array.from({ length: n }, (_, i) => (i * period) / n);

describe("at rest", () => {
  test("amplitude zero moves nothing ambient", () => {
    // The claim `animate={false}` rests on. Every ambient layer is multiplied
    // by amplitude, so a blobatar that is not being animated has to be
    // pixel-identical to a still one rather than nearly so, and "nearly" is
    // what a missed `* amp` looks like.
    for (const t of sweep(20000, 500)) {
      const f = idleAt(S, t, 0);
      expect(f.breathe).toEqual([1, 1]);
      // `toBeCloseTo` rather than `toBe`, because `-1.1 * 0` is negative zero
      // and `Object.is(-0, 0)` is false. It reaches the renderer as "0" either
      // way, since `String(-0)` is "0", so this is a fact about the assertion
      // and not about the picture.
      expect(f.bob).toBeCloseTo(0, 12);
      expect(f.saccade[0]).toBeCloseTo(0, 12);
      expect(f.saccade[1]).toBeCloseTo(0, 12);
      expect(f.blink).toBe(1);
      for (const v of Object.values(f.wrap)) expect(v).toBeCloseTo(0, 12);
    }
  });

  test("the tremor rides the pose, not the amplitude", () => {
    // `shake` is a pose channel: a `mad` blobatar trembles because `mad` says
    // so. So it has to move at amplitude zero and be still at `shake` zero,
    // which is the opposite of every other layer here and the thing most
    // likely to be wired up like its neighbours.
    const still = sweep(112).map(t => idleAt(S, t, 1, 0).shake);
    expect(still.every(([x, y]) => x === 0 && y === 0)).toBe(true);

    const moving = sweep(112).map(t => idleAt(S, t, 0, 1).shake);
    expect(moving.some(([x, y]) => x !== 0 || y !== 0)).toBe(true);
  });

  test("a blobatar at rest composes exactly like a still one", () => {
    // The anchor. `poseTransforms` is held against `bakePose` at every pose in
    // `morph.test.ts`, so an idle layer that reduces to it at rest inherits all
    // of that rather than asserting it again.
    for (const name of ["alain", "ada", "grace"]) {
      const l = layout(name);
      for (const e of [idle, happy, mad, thinking]) {
        // Amplitude zero *and* the seesaw at its extreme, which is a whole
        // number of 900ms cycles in. Rest is not just "no amplitude": `rock`
        // is a pose channel like `shake`, so its loop is not amplitude-gated
        // and a `thinking` blobatar seesaws whether or not anything is ramping
        // it. The stylesheet says the same thing by pausing the loop on touch
        // rather than by scaling it, and pausing lands on `--mo-rockp: 1`,
        // which is this.
        const f = idleAt(seeds(name), 0, 0);
        const t = idleTransforms(l, e.p, f);
        expect(t.eye).toEqual(poseTransforms(l, e.p).eyes);
        expect(t.root).toBe("translate(0 0)");
        expect(t.breathe).toBe("translate(50 50) scale(1 1) translate(-50 -50)");
        expect(t.eyes).toBe("translate(0 0)");
        // The body wrap carries the pose's own lift, which is not the idle
        // layer's and must survive it.
        expect(t.bob).toBe(poseTransforms(l, e.p).wrap);
      }
    }
  });

  test("rockp defaults to the extreme the still renderer bakes", () => {
    // `poseTransforms(l, p)` and `poseTransforms(l, p, 1)` are the same call,
    // which is what makes a still `thinking` blobatar frame zero of the seesaw
    // rather than an approximation of it.
    const l = layout("alain");
    expect(poseTransforms(l, thinking.p)).toEqual(poseTransforms(l, thinking.p, 1));
    expect(idleAt(S, 0, 1).rockp).toBeCloseTo(1, 10);
  });
});

describe("the ambient layers", () => {
  test("breathe and bob stay inside the amplitudes the stylesheet declares", () => {
    let sx = [2, 0];
    let sy = [2, 0];
    let bob = [1, -2];
    for (const t of sweep(2800 * 2, 2000)) {
      const f = idleAt(S, t, 1);
      sx = [Math.min(sx[0]!, f.breathe[0]), Math.max(sx[1]!, f.breathe[0])];
      sy = [Math.min(sy[0]!, f.breathe[1]), Math.max(sy[1]!, f.breathe[1])];
    }
    for (const t of sweep(3400 * 2, 2000)) {
      bob = [Math.min(bob[0]!, idleAt(S, t, 1).bob), Math.max(bob[1]!, idleAt(S, t, 1).bob)];
    }
    // 1 ± 0.022 across, 1 − 0.018 down, 1.1 up. A uniform scale would read as a
    // zoom; the asymmetry is what reads as something soft holding air.
    expect(sx[0]!).toBeCloseTo(1, 2);
    expect(sx[1]!).toBeCloseTo(1.022, 3);
    expect(sy[0]!).toBeCloseTo(0.982, 3);
    expect(sy[1]!).toBeCloseTo(1, 2);
    expect(bob[0]!).toBeCloseTo(-1.1, 2);
    expect(bob[1]!).toBeCloseTo(0, 2);
  });

  test("they alternate rather than reset, so nothing jumps", () => {
    // `animation-direction: alternate`. Read as a sawtooth instead, a breathing
    // blobatar would snap back to empty lungs every 2800ms, which is the one
    // failure in this layer that is obvious on a device and invisible here
    // unless it is asserted.
    const period = 2800 * 2;
    for (const t of sweep(period, 300)) {
      const a = idleAt(S, t, 1).breathe[0];
      const b = idleAt(S, t + 1, 1).breathe[0];
      expect(Math.abs(b - a)).toBeLessThan(0.001);
    }
    // …and it does return to where it started, a full there-and-back later.
    expect(idleAt(S, 5000, 1).breathe[0]).toBeCloseTo(idleAt(S, 5000 + period, 1).breathe[0], 9);
  });
});

describe("the eyes", () => {
  test("the blink is one flicker in a multi-second cycle", () => {
    const open = sweep(S.blink, 1000).filter(t => idleAt(S, t, 1).blink > 0.999);
    // Open for the overwhelming majority of the cycle, which is what makes a
    // loop that runs forever on every blobatar affordable.
    expect(open.length / 1000).toBeGreaterThan(0.95);
    // And it does actually close, nearly all the way. Read at the keyframe
    // rather than off a sweep: the shut point is 1.4% of the cycle wide and a
    // sweep fine enough to land on it exactly is finer than this loop needs to
    // be anywhere else.
    expect(idleAt(S, 0.986 * S.blink - S.blinkPhase, 1).blink).toBeCloseTo(0.08, 6);
  });

  test("the blink is a scale and never an inversion", () => {
    // A negative scaleY turns an eye inside out for a frame. It is one sign
    // error away and it is the kind of thing that only shows on a device.
    for (const t of sweep(S.blink, 4000)) expect(idleAt(S, t, 1).blink).toBeGreaterThan(0);
  });

  test("the saccade holds and flicks rather than drifting", () => {
    // Eyes jump and settle. Sampled across one cycle, the offsets have to
    // cluster on the six fixations rather than spread evenly between them, and
    // a linear interpolation over the whole cycle is exactly what this catches.
    const xs = sweep(S.saccade, 600).map(t => idleAt(S, t, 1).saccade[0]);
    const held = xs.filter((x, i) => i > 0 && Math.abs(x - xs[i - 1]!) < 1e-9);
    expect(held.length / xs.length).toBeGreaterThan(0.8);
  });

  test("the seesaw reaches both ends", () => {
    const ps = sweep(900, 900).map(t => idleAt(S, t, 1).rockp);
    expect(Math.max(...ps)).toBeCloseTo(1, 3);
    expect(Math.min(...ps)).toBeCloseTo(-1, 3);
  });
});

describe("the crowd", () => {
  test("two names are not in step", () => {
    // The single most load-bearing property in the whole motion layer: a grid
    // where everything breathes together reads as a heartbeat rather than as a
    // crowd of creatures. It is also the one that a JavaScript port can lose
    // wholesale, by starting every blobatar's clock at its own mount.
    const names = ["alain", "ada", "grace", "linus", "ken", "barbara"];
    const at = names.map(n => idleAt(seeds(n), 0, 1).breathe[0]);
    expect(new Set(at.map(v => v.toFixed(4))).size).toBeGreaterThan(names.length - 2);
  });

  test("breathe and bob drift independently on one blobatar too", () => {
    // Sharing one offset preserves the drift between the two periods and locks
    // every blobatar into the *same* drift, which is the unison problem again
    // one level up. Different draws, so different phases.
    expect(S.phase).not.toBe(S.bob);
  });

  test("the clock's origin does not matter", () => {
    // Every loop is infinite and phase-offset, so there is no moment that is
    // the beginning of anything. A blobatar mounted late has to be in step with
    // one mounted early, which is what lets a list mount rows as it scrolls.
    const a = idleAt(S, 9_000_000, 1, 1);
    const b = idleAt(S, 9_000_000, 1, 1);
    expect(a).toEqual(b);
    // Nothing degrades at a large elapsed time either, which a naive
    // accumulate-per-frame driver would not manage.
    expect(Number.isFinite(a.breathe[0])).toBe(true);
    expect(a.blink).toBeGreaterThan(0);
  });
});
