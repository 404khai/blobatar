import type { Posable } from "./expression";
import type { Style } from "./render";
import * as blob from "./styles/blob";

/**
 * One frozen seed → look mapping.
 *
 * A generation is the whole answer to "what does this name look like": the
 * silhouette vocabulary and its thresholds, every numeric range the layout
 * reads a trait into, and the tone set. Those are frozen together because they
 * are observed together — a caller cannot tell which of them moved, only that
 * their user's blobatar is now somebody else's.
 *
 * Adding a silhouette is not additive. `shapeOf` partitions [0, 1) into bands
 * and a new band has to take its probability mass from the existing ones, so
 * every seed in the moved region changes shape. That is why this exists rather
 * than a `shapes` option: the library cannot know who is relying on the old
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
   */
  readonly id: number;
};

/**
 * The original six: round, organic, boxy, nub, cloud, sun.
 *
 * The default in `blobatar@0.x` and `@1.x`, and importable in every major after
 * that — pinning it is how a caller keeps their users' blobatars through an
 * upgrade that moves the default. Frozen by `test/golden/gen1.txt`, where a
 * diff is a breaking change rather than a test to update.
 */
export const gen1: Generation = { id: 1, ...blob };
