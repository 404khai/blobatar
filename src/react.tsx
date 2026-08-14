import { useMemo, type ImgHTMLAttributes } from "react";
import type { AvatarOptions } from "./avatar";
import { avatarUri } from "./uri";

export interface AvatarProps extends AvatarOptions, Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  seed: string;
}

/**
 * Renders as an <img> rather than inline SVG.
 *
 * Inline SVG would let CSS reach the shapes, but nothing here uses
 * `currentColor`, and lists of avatars are exactly the case where you do not
 * want a few hundred extra DOM nodes per screen.
 */
export function Avatar({
  seed,
  size,
  background,
  palette,
  hue,
  normalize,
  contrast,
  title,
  alt,
  ...rest
}: AvatarProps) {
  const src = useMemo(
    () => avatarUri(seed, { size, background, palette, hue, normalize, contrast, title }),
    [seed, size, background, palette, hue, normalize, contrast, title],
  );

  return <img src={src} width={size} height={size} alt={alt ?? title ?? ""} {...rest} />;
}
