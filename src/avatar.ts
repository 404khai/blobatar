import type { Palette, Variant } from "./color";
import { makeAvatar, resolve, type AvatarOptions } from "./render";
import * as character from "./styles/character";
import * as blob from "./styles/blob";

export type { Variant, AvatarOptions };

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
