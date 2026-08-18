/**
 * The generations, as the site needs them.
 *
 * Shared by the landing hero and the editor, which both let you pick a
 * silhouette and both print the code that produces it. They had their own
 * copies of the band midpoints before there was more than one generation — two
 * copies of six numbers, each with a comment explaining that it was a copy —
 * and a second vocabulary would have made it three copies of sixteen. So the
 * tables live here and the two pages import them.
 *
 * `packages/blobatar/test/golden/corpus.ts` is still the authority: these are
 * copied from the midpoints that pin each generation's full render, rather than
 * derived from `shapeOf`'s thresholds. That is deliberate and is the reason a
 * copy is tolerable at all — a retune fails a test in the package instead of
 * silently moving every config anyone saved off this site.
 */
import { gen1, gen2, type Generation } from "blobatar/generation";

/**
 * Which generation is on screen.
 *
 * The library's `Generation` is a value — three functions and a flag — and what
 * a page needs is a scalar: something to key the tables below by, hold in a
 * `useState`, and compare. `Generation.id` is exactly that scalar and exists
 * for a closely related reason (ADR-0006), so this mirrors it rather than
 * inventing a second identity for the same thing.
 */
export type Gen = 1 | 2;

/** The generations offered, oldest first — picker order. */
export const GENS: Gen[] = [1, 2];

/**
 * The default for this major, which is what you get without asking.
 *
 * Not a constant either page should hardcode: it is what decides whether a
 * snippet mentions a generation at all, and per ADR-0006 it moves when the
 * package's major does.
 */
export const DEFAULT_GEN: Gen = 1;

/** The values themselves, for actually rendering one. */
export const GENERATIONS: Record<Gen, Generation> = { 1: gen1, 2: gen2 };

/** The identifier a snippet imports to pin one. `null` for the default. */
export const identifier = (gen: Gen) => (gen === DEFAULT_GEN ? null : `gen${gen}`);

export type Shape =
  | "round"
  | "organic"
  | "boxy"
  | "nub"
  | "cloud"
  | "sun"
  | "capsule"
  | "triangle"
  | "hexagon"
  | "droplet";

export interface ShapeOption {
  name: Shape;
  /** The position in [0, 1) that selects it — what gets pinned. */
  at: number;
}

/**
 * Each generation's silhouettes, as the trait position that selects one.
 *
 * Shape is not a named option — the library exposes it as a pinned *trait*, and
 * a trait value is "the number the hash would have produced". So these are the
 * midpoints of the bands `shapeOf` splits [0, 1) into, midpoints rather than
 * edges because the bands are frozen per generation but their boundaries are
 * the one place a retune would land.
 *
 * The same number means different things in different generations — 0.885 is a
 * cloud under gen1 and a droplet under gen2 — which is why this is keyed rather
 * than merged, and why switching generation has to carry a pinned shape across
 * by *name*.
 */
export const SHAPES: Record<Gen, ShapeOption[]> = {
  1: [
    { name: "round", at: 0.14 },
    { name: "organic", at: 0.43 },
    { name: "boxy", at: 0.65 },
    { name: "nub", at: 0.78 },
    { name: "cloud", at: 0.885 },
    { name: "sun", at: 0.965 },
  ],
  2: [
    { name: "round", at: 0.11 },
    { name: "organic", at: 0.35 },
    { name: "boxy", at: 0.54 },
    { name: "capsule", at: 0.65 },
    { name: "nub", at: 0.745 },
    { name: "cloud", at: 0.825 },
    { name: "droplet", at: 0.888 },
    { name: "hexagon", at: 0.933 },
    { name: "sun", at: 0.965 },
    { name: "triangle", at: 0.99 },
  ],
};

/**
 * The same silhouette in another generation, or `null` if it has none.
 *
 * What both pages need when the generation changes under a pinned shape.
 * Carrying the *number* would silently change the creature; dropping the pin
 * would silently discard a choice. The name is the thing that means the same in
 * both vocabularies, so the name is what carries.
 */
export const sameShape = (from: Gen, to: Gen, at: number): ShapeOption | null => {
  const was = SHAPES[from].find(s => s.at === at);
  return (was && SHAPES[to].find(s => s.name === was.name)) ?? null;
};
