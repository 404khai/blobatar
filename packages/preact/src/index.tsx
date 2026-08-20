import { useMemo } from "preact/hooks";
import type { JSX } from "preact";
import { _parts, type BlobatarOptions } from "blobatar/internal";
import { blobatarUri } from "blobatar/uri";
import type { Animate } from "blobatar/internal";

type StaticProps = { animate?: false } & Omit<JSX.HTMLAttributes<HTMLImageElement>, "src">;

type AnimatedProps = { animate: Animate } & Omit<
  JSX.SVGAttributes<SVGSVGElement>,
  "children"
>;

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id — any string, and the same string always renders the
   * same blobatar. The only required prop.
   */
  name: string;
} & BlobatarOptions &
  (StaticProps | AnimatedProps);

export function Blobatar({
  name: seed,
  size,
  background,
  palette,
  hue,
  tone,
  normalize,
  contrast,
  title,
  animate,
  expression,
  traits,
  ...rest
}: BlobatarProps) {
  const opts = { size, background, palette, hue, tone, normalize, contrast, title, expression, traits };

  const dep = JSON.stringify([seed, opts, animate]);

  const src = useMemo(
    () => (animate ? "" : blobatarUri(seed, opts)),
    [dep],
  );

  const parts = useMemo(
    () => (animate ? _parts(seed, { ...opts, animate }) : null),
    [dep],
  );

  const html = useMemo(() => parts?.inner ?? "", [parts?.inner]);

  if (parts) {
    const { style, ...svgRest } = rest as JSX.SVGAttributes<SVGSVGElement>;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        style={{ ...(parts.vars as Record<string, string>), ...(style as Record<string, string>) }}
        {...svgRest}
      >
        {title ? <title>{title}</title> : null}
        {parts.bg ? <path d={parts.bg.d} fill={parts.bg.fill} /> : null}
        <g class={parts.cls} dangerouslySetInnerHTML={{ __html: html }} />
      </svg>
    );
  }

  const { alt, ...imgRest } = rest as JSX.HTMLAttributes<HTMLImageElement> & { alt?: string };
  return <img src={src} width={size} height={size} alt={alt ?? title ?? ""} {...imgRest} />;
}
