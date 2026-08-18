/**
 * The freeze.
 *
 * Every other determinism test in this suite asserts self-consistency — the
 * same seed twice in one process — which is a property the library cannot
 * plausibly lose. This is the one that asserts the thing actually promised: the
 * same seed, across versions, forever. Without it a one-character edit to
 * `shapeOf` changes every existing user's avatar and CI stays green.
 *
 * A failure here is not a test to update. See `test/golden/format.ts`.
 */

import { describe, expect, test } from "bun:test";
import { HISTOGRAM_SEEDS, cases, histogram, markup } from "./golden/corpus";
import { hash, parse } from "./golden/format";

const fixture = parse(await Bun.file(`${import.meta.dir}/golden/gen1.txt`).text());

/** A failure lists names, not a thousand hashes. */
const report = (moved: string[], total: number) =>
  `${moved.length} of ${total} moved — e.g. ${moved.slice(0, 5).join(", ")}` +
  (moved.length > 5 ? `, …` : "");

describe("gen1 is frozen", () => {
  /*
   * First, because it is the section that names the cause. A markup hash tells
   * you a seed moved; a count tells you which band moved and in which
   * direction, which is usually the whole diagnosis.
   */
  test("the shape distribution is unchanged", () => {
    const counts = histogram();

    expect(counts.map(([shape]) => String(shape))).toEqual([...fixture.histogram.keys()]);

    for (const [shape, n] of counts) {
      const was = Number(fixture.histogram.get(shape));
      expect(`${shape} ${n}`).toBe(`${shape} ${was}`);
    }

    // The weighting the README promises, checked against the recorded numbers
    // rather than restated as a second set of magic constants.
    const total = counts.reduce((a, [, n]) => a + n, 0);
    expect(total).toBe(HISTOGRAM_SEEDS);
  });

  test("the recorded renders are byte-identical", () => {
    const now = markup();
    expect(now.map(([label]) => label)).toEqual([...fixture.markup.keys()]);

    for (const [label, svg] of now) {
      // Compared as `label\n<svg>` so a failure names the case in its own diff
      // rather than only in the assertion's line number.
      expect(`${label}\n${svg}`).toBe(`${label}\n${fixture.markup.get(label)}`);
    }
  });

  test("every seed and option combination still hashes the same", () => {
    const moved: string[] = [];
    const unrecorded: string[] = [];
    let total = 0;

    for (const [label, svg] of cases()) {
      total++;
      const was = fixture.hashes.get(label);
      if (was === undefined) unrecorded.push(label);
      else if (was !== hash(svg)) moved.push(label);
    }

    // Separated from the mismatch check because they mean opposite things: a
    // moved hash is a regression in the library, an unrecorded case is a gap in
    // the fixture, and only the second is fixed by regenerating.
    expect(
      unrecorded.length === 0
        ? "every case is recorded"
        : `not in the fixture — regenerate: ${report(unrecorded, total)}`,
    ).toBe("every case is recorded");

    expect(
      moved.length === 0 ? "gen1 is unchanged" : `gen1 moved: ${report(moved, total)}`,
    ).toBe("gen1 is unchanged");

    expect(fixture.hashes.size).toBe(total);
  });
});
