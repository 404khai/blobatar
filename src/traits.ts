import { seedState, stream } from "./hash";

/**
 * A trait reader. Every value is addressed by a string key rather than drawn
 * from a sequential stream, so trait keys are an append-only namespace:
 * introducing `t.num("freckles.size", ...)` in a later version leaves every
 * other trait — and therefore every existing avatar — untouched.
 *
 * The one thing that is NOT free to change is the contents of a `pick` array,
 * since option index is part of the mapping. Those are frozen per major.
 */
export interface Traits {
  /** Uniform float in [0, 1). */
  (key: string): number;
  /** Uniform float in [min, max). */
  num(key: string, min: number, max: number): number;
  /** Uniform integer in [min, max]. */
  int(key: string, min: number, max: number): number;
  /** Uniform choice. Appending to `options` remaps existing seeds — frozen per major. */
  pick<T>(key: string, options: readonly T[]): T;
  /** True with probability `p`. */
  bool(key: string, p?: number): boolean;
  /** Symmetric jitter in [-amount, amount). */
  jitter(key: string, amount: number): number;
}

export function traits(seed: string, normalize = true): Traits {
  const state = seedState(seed, normalize);
  const t = ((key: string) => stream(state, key)) as Traits;

  t.num = (key, min, max) => min + t(key) * (max - min);
  t.int = (key, min, max) => min + Math.floor(t(key) * (max - min + 1));
  t.pick = (key, options) => options[Math.floor(t(key) * options.length)]!;
  t.bool = (key, p = 0.5) => t(key) < p;
  t.jitter = (key, amount) => (t(key) * 2 - 1) * amount;

  return t;
}
