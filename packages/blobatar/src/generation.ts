import type { Posable } from "./expression";
import type { Style } from "./render";
import { bodyFit, compose, faceFit, type Band } from "./styles/compose";
import {
  boxy, capsule, cloud, droplet, hexagon, nub, organic, round, sun, triangle,
} from "./styles/shapes";

/**
 * One frozen seed → look mapping.
 *
 * A generation is the whole answer to "what does this name look like": the
 * silhouette vocabulary and its thresholds, every numeric range the layout
 * reads a trait into, and the tone set. Those are frozen together because they
 * are observed together — a caller cannot tell which of them moved, only that
 * their user's blobatar is now somebody else's.
 *
 * Adding a silhouette is not additive. The band table partitions [0, 1) and a
 * new band has to take its probability mass from the existing ones, so every
 * seed in the moved region changes shape. That is why this exists rather than a
 * `shapes` option: the library cannot know who is relying on the old
 * vocabulary, so the caller has to be able to say.
 *
 * Passed in as a value, for the reason ADR-0002 gives for expressions: a
 * consumer who never names a generation carries only the default one. The rest
 * cost what they weigh, and only to whoever asked.
 *
 * ```ts
 * import { blobatar } from "blobatar";
 * import { gen1 } from "blobatar/generation";
 *
 * blobatar(user.email, { generation: gen1 }); // pinned across majors
 * ```
 *
 * Both generations below are `compose(bands, fit)` over the shared vocabulary
 * in `blobatar/shapes` — the same mechanism a caller composing their own
 * generation uses, rather than a private one. See ADR-0007.
 */
export type Generation = Style<Posable> & {
  /**
   * Which generation this is.
   *
   * Load-bearing rather than decorative: `blobatar/react` memoizes on
   * `JSON.stringify` of its options, and a generation is three functions and a
   * background flag — two of them serialize identically, so without something
   * scalar to compare, switching generation would not invalidate the memo and
   * the component would keep rendering the old one.
   *
   * More reachable now that generations are composable, and still unenforceable:
   * a caller composing their own must pick an id nothing else uses, and nothing
   * in the library can check it. Ids 1 and 2 are taken.
   */
  readonly id: number;
};

/**
 * gen1's bands: the original six.
 *
 * Weighted rather than uniform — rounds and pebbles are the everyday shapes,
 * and suns and clouds are the ones you want to be pleased to see. Each number
 * is the upper edge of that shape's band in [0, 1).
 *
 * Frozen. This table *is* the contract `test/golden/gen1.txt` records.
 */
const GEN1: Band[] = [
  [round, 0.28], [organic, 0.58], [boxy, 0.72], [nub, 0.84], [cloud, 0.93], [sun, 1],
];

/**
 * gen2's bands: the same six, reweighted, plus four.
 *
 * Not gen1's table stretched over ten slots. The four new silhouettes take
 * their mass mostly from `round` and `organic`, which were the two widest
 * bands, so the everyday shapes stay everyday and the rare ones stay rare —
 * see the histogram in `test/golden/gen2.txt` for what it actually produces.
 */
const GEN2: Band[] = [
  [round, 0.22], [organic, 0.48], [boxy, 0.6], [capsule, 0.7], [nub, 0.79],
  [cloud, 0.86], [droplet, 0.915], [hexagon, 0.95], [sun, 0.98], [triangle, 1],
];

/*
 * `@__PURE__` on both, and it is load-bearing rather than tidy.
 *
 * `{ id, ...compose(...) }` spreads a *call result*, and a bundler will not
 * assume a call is side-effect-free — so without this, `gen2` survives into a
 * bundle that only ever imported `gen1`, carrying four silhouettes and the
 * rounded-polygon primitive with it. That is the same failure the old
 * `{ id: 2, ...blob2 }` namespace spread caused, and it cost a kilobyte.
 *
 * The `blob + gen1` row in `scripts/size.ts` is what proves this works. If it
 * ever lands within a few bytes of `blob + gen2`, this annotation stopped
 * being honoured and gen2 is in everybody's bundle again.
 */

/**
 * The original six: round, organic, boxy, nub, cloud, sun.
 *
 * The default in `blobatar@0.x` and `@1.x`, and importable in every major after
 * that — pinning it is how a caller keeps their users' blobatars through an
 * upgrade that moves the default. Frozen by `test/golden/gen1.txt`, where a
 * diff is a breaking change rather than a test to update.
 */
export const gen1: Generation = /* @__PURE__ */ (() => ({
  id: 1,
  ...compose(GEN1, bodyFit),
}))();

/**
 * The original six plus four: `capsule`, `triangle`, `hexagon` and `droplet`.
 *
 * Not the default in `blobatar@0.x`. Moving the default is a major bump, per
 * ADR-0006, so this ships importable-and-opt-in — `{ generation: gen2 }` in the
 * library, `?gen=2` on the endpoint — and becomes the default at `2.0.0`.
 *
 * It also fits the eyes differently: `faceFit` measures the cluster against
 * each shape's own face on both axes, where gen1's `bodyFit` measures against
 * the body radius on one. That is what lets a triangle or a droplet carry eyes
 * at all, and it is why the fit is a parameter rather than a fix — applying it
 * to gen1 would move every existing blobatar.
 */
export const gen2: Generation = /* @__PURE__ */ (() => ({
  id: 2,
  ...compose(GEN2, faceFit),
}))();
