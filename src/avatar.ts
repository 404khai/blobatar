import { motionVars, rootClass, type Animate } from "./animate";
import type { Palette, Variant } from "./color";
import { makeAvatar, makeParts, resolve, type AvatarOptions } from "./render";
import type { Traits } from "./traits";
import * as character from "./styles/character";
import * as blob from "./styles/blob";

export type { Variant, AvatarOptions, Animate };

const AVATARS = {
  blob: makeAvatar(blob, "blob"),
  character: makeAvatar(character, "character"),
};


/**
 * Renders a deterministic avatar as SVG markup.
 *
 * The same seed always produces the same output within a major version. The
 * numeric ranges in each variant's `layout`, its categorical thresholds, and the
 * tone set are all part of that contract: changing any of them reshuffles
 * existing avatars.
 *
 * This entry carries every variant. Import `morphatar/blob` or
 * `morphatar/character` directly if you only ship one.
 */
export function avatar(seed: string, opts: AvatarOptions = {}): string {
  return AVATARS[opts.variant ?? "blob"](seed, opts);
}

/** Only constructed when someone actually animates, so it tree-shakes away. */
const motion = (mode: Animate) => (t: Traits) => ({
  cls: rootClass(mode),
  vars: motionVars(t),
});

/**
 * The `<svg>` contents and its motion custom properties, separately.
 *
 * For renderers that own the outer element themselves — `morphatar/react` when
 * animating. Underscored because the shape of this object is not public API.
 */
export function _parts(seed: string, opts: AvatarOptions = {}) {
  // Built per call rather than hoisted into a module-level table like `AVATARS`
  // above: a hoisted table is a top-level function call, which bundlers cannot
  // prove is side-effect-free, so it would survive tree-shaking and charge
  // every static consumer ~145 B for a path they never take. `_layout` below
  // is written this way for the same reason.
  const variant = opts.variant ?? "blob";
  const style = variant === "blob" ? blob : character;
  return makeParts(style as never, variant)(
    seed,
    opts,
    opts.animate && motion(opts.animate),
  );
}

/**
 * The numeric layout and resolved palette, before serialization.
 *
 * Kept separate from rendering so geometric invariants — features staying
 * inside the body, the body staying inside the frame — can be asserted directly
 * rather than by parsing path data back out of the markup. Underscored because
 * the shape of this object is not public API.
 */
export function _layout(seed: string, opts: AvatarOptions = {}) {
  const variant = opts.variant ?? "blob";
  const style = variant === "blob" ? blob : character;
  const { t, palette } = resolve(style as never, variant, seed, opts);
  return { variant, palette: palette as Palette, ...style.layout(t) };
}
