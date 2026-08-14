import { palette as buildPalette, type Palette, type Variant } from "./color";
import { superellipse } from "./shape";
import { traits, type Traits } from "./traits";

export interface AvatarOptions {
  /** Which look to render. Default `"blob"`. Ignored by the per-variant entries. */
  variant?: Variant;
  /** Emits width/height attributes. Omit to let CSS size it (the viewBox always scales). */
  size?: number;
  /** Overrides the variant's own default. `false` renders transparent. */
  background?: boolean | "square" | "circle" | "squircle";
  /** Overrides specific palette entries. Overridden colors bypass the contrast guarantee. */
  palette?: Palette;
  /** Locks the hue in degrees, so the seed drives shape only. */
  hue?: number;
  /** Locks the `blob` tone as a 0–1 position in the swatch set. */
  tone?: number;
  /** Applies NFC + trim + lowercase to the seed. Default true. */
  normalize?: boolean;
  /** Enforces the minimum contrast ratios. Default true. */
  contrast?: boolean;
  /** Adds a <title> for screen readers. */
  title?: string;
}

export interface Style<L> {
  layout(t: Traits): L;
  render(l: L, p: Palette): string;
  background: boolean | "square" | "circle" | "squircle";
}

const escape = (s: string) =>
  s.replace(/[&<>]/g, c => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

export function resolve<L>(style: Style<L>, variant: Variant, seed: string, opts: AvatarOptions) {
  const t = traits(seed, opts.normalize ?? true);
  return {
    t,
    palette: {
      ...buildPalette(
        opts.hue ?? t.num("hue", 0, 360),
        variant,
        opts.contrast ?? true,
        opts.tone ?? t("tone"),
      ),
      ...opts.palette,
    } as Palette,
  };
}

/**
 * Binds one style into an `avatar(seed, opts)` function.
 *
 * The wrapper exists so the per-variant entry points (`morphatar/blob`,
 * `morphatar/character`) can each pull in exactly one style. Importing the
 * dispatcher instead costs both, which the size gate will tell you about.
 */
export function makeAvatar<L>(style: Style<L>, variant: Variant) {
  return (seed: string, opts: AvatarOptions = {}): string => {
    const { t, palette: p } = resolve(style, variant, seed, opts);
    const out: string[] = [];

    // The backdrop is a shared concern, so variants declare a default rather
    // than each drawing their own.
    const bg = opts.background ?? style.background;
    if (bg === "square") {
      out.push(`<path d="M0 0H100V100H0Z" fill="${p.bg}"/>`);
    } else if (bg !== false) {
      const d = superellipse({ cx: 50, cy: 50, rx: 50, ry: 50, n: bg === "circle" ? 2 : 6 });
      out.push(`<path d="${d}" fill="${p.bg}"/>`);
    }

    out.push(style.render(style.layout(t), p));

    const dim = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    const title = opts.title ? `<title>${escape(opts.title)}</title>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dim}>${title}${out.join("")}</svg>`;
  };
}
