import type { Animate } from "./animate";
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
  /**
   * Idle animation. Off by default.
   *
   * Requires `import "morphatar/motion.css"`, and requires the avatar to be
   * inline SVG — content inside an `<img>` is an isolated document that hover
   * cannot reach. `morphatar/react` switches rendering mode for you; the string
   * API is already inline.
   *
   * **Honored by `morphatar/react` only, for now.** `avatar()` returns static
   * markup regardless: a branch on `animate` inside it keeps the motion module
   * alive for every caller, animating or not, which measured at ~145 B on the
   * dispatcher and ~190 B on the single-variant entries. An animated string API
   * wants its own entry point, not a branch here.
   */
  animate?: Animate;
}

export interface Style<L> {
  layout(t: Traits): L;
  /** `mo` is the root class when animating, absent otherwise. */
  render(l: L, p: Palette, mo?: string): string;
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

/** Screen-reader label, if one was asked for. */
const label = (opts: AvatarOptions) =>
  opts.title ? `<title>${escape(opts.title)}</title>` : "";

/**
 * The backdrop is a shared concern, so variants declare a default rather than
 * each drawing their own.
 */
function backdrop<L>(style: Style<L>, opts: AvatarOptions, p: Palette): string {
  const bg = opts.background ?? style.background;
  if (bg === "square") return `<path d="M0 0H100V100H0Z" fill="${p.bg}"/>`;
  if (bg === false) return "";
  const d = superellipse({ cx: 50, cy: 50, rx: 50, ry: 50, n: bg === "circle" ? 2 : 6 });
  return `<path d="${d}" fill="${p.bg}"/>`;
}

/**
 * What a motion factory hands back: the root class, and the seeded timing to
 * put on the outer element.
 *
 * Passed *in* rather than imported, so `src/animate.ts` never enters a bundle
 * that does not animate. That indirection is the entire reason the static path
 * still costs what it did before the motion layer existed — a plain
 * `if (opts.animate)` here would pull the motion module into every consumer,
 * animating or not.
 */
export interface Motion {
  cls: string;
  vars: Record<string, string>;
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
    const dim = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    const body = label(opts) + backdrop(style, opts, p) + style.render(style.layout(t), p);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${dim}>${body}</svg>`;
  };
}

/**
 * Everything that goes *inside* the `<svg>`, plus the custom properties that
 * belong on it.
 *
 * Split out from `makeAvatar` because the React adapter has to own the outer
 * element when animating — it needs real JSX props on it — and recovering the
 * inner markup by regex-stripping a serialized `<svg>` is the kind of thing
 * that works until someone passes a `title` containing a `>`.
 */
export function makeParts<L>(style: Style<L>, variant: Variant) {
  return (seed: string, opts: AvatarOptions = {}, motion?: (t: Traits) => Motion) => {
    const { t, palette: p } = resolve(style, variant, seed, opts);
    const mo = motion?.(t);

    return {
      // The motion wrapper goes inside `style.render`, not around this whole
      // string: the backdrop is drawn here, and wrapping at this level would
      // breathe the plate along with the body. `blob` is transparent by
      // default, so that mistake stays invisible until someone passes a
      // background.
      inner: label(opts) + backdrop(style, opts, p) + style.render(style.layout(t), p, mo?.cls),
      vars: mo?.vars,
    };
  };
}
