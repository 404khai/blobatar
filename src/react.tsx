import { useMemo, type ImgHTMLAttributes, type SVGProps } from "react";
import type { Animate } from "./animate";
import { _parts, type AvatarOptions } from "./avatar";
import { avatarUri } from "./uri";

/**
 * Two rendering modes, and the props follow the mode.
 *
 * Static avatars render as an `<img>`: a list of a few hundred is exactly the
 * case where you do not want extra DOM nodes per screen, and nothing here uses
 * `currentColor`, so inline SVG would buy nothing.
 *
 * Animated avatars cannot. Content inside an `<img>` is an isolated,
 * non-interactive document — `:hover` never fires inside it and host-page CSS
 * cannot reach the shapes — so `animate` switches to inline SVG and costs
 * roughly a dozen nodes per avatar. That trade is the reason animation is
 * opt-in rather than a default.
 *
 * The union is deliberate: `onLoad` should stop type-checking the moment you
 * turn animation on, because it stops firing.
 */
type StaticProps = { animate?: false } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">;

type AnimatedProps = { animate: Animate } & Omit<
  SVGProps<SVGSVGElement>,
  "children" | "dangerouslySetInnerHTML" | "viewBox"
>;

export type AvatarProps = { seed: string } & AvatarOptions & (StaticProps | AnimatedProps);

export function Avatar({
  seed,
  size,
  background,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  animate,
  ...rest
}: AvatarProps) {
  const opts = { size, background, palette, hue, tone, normalize, contrast, title };

  // Both branches are hooks-stable: `animate` changing swaps the element type,
  // which remounts anyway.
  const dep = JSON.stringify([seed, opts, animate]);

  const src = useMemo(
    () => (animate ? "" : avatarUri(seed, opts)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );

  const parts = useMemo(
    () => (animate ? _parts(seed, { ...opts, animate }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );

  if (parts) {
    const { style, ...svgRest } = rest as SVGProps<SVGSVGElement>;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        // With a `title` the markup carries a `<title>`, so this is a labelled
        // image; without one it is decoration and should be skipped entirely —
        // the same call `alt=""` makes on the `<img>` path. Never both: a
        // `role="img"` that is also `aria-hidden` just contradicts itself.
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        style={{ ...(parts.vars as React.CSSProperties), ...style }}
        dangerouslySetInnerHTML={{ __html: parts.inner }}
        {...svgRest}
      />
    );
  }

  const { alt, ...imgRest } = rest as ImgHTMLAttributes<HTMLImageElement>;
  return <img src={src} width={size} height={size} alt={alt ?? title ?? ""} {...imgRest} />;
}
