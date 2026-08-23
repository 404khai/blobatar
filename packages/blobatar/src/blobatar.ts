import { motionVars, rootClass, type Animate } from "./animate";
import type { Palette } from "./color";
import type { Expression } from "./expression";
import {
  backdrop, makeBlobatar, makeParts, posed, resolve, tinted,
  type BlobatarOptions,
} from "./render";
import { style } from "./styles/blob";
import { marks, type Layout, type Mark } from "./styles/compose";
import type { Traits } from "./traits";

export type { BlobatarOptions, Animate, Expression, Mark };

/**
 * Renders a deterministic blobatar as SVG markup.
 *
 * The same name always produces the same output within a major version. The
 * numeric ranges in `styles/compose.ts`, the bands in `styles/blob.ts`, and the
 * tone set are all part of that contract. Changing them requires a new major.
 */
export const blobatar = makeBlobatar(style);

/**
 * Only constructed when someone actually animates, so it tree-shakes away.
 *
 * The pose rides along here rather than in `makeParts` because this is already
 * the seam that keeps the motion modules out of static bundles — and when
 * animating, the pose is custom properties on the same element the timing goes
 * on, not geometry. `poseVars` returns nothing at all for `"idle"`.
 */
const motion = (mode: Animate, e?: Expression) => (t: Traits, p: Palette) => {
  // `vars` is also how we know whether to set `mo-expr`: an expression that
  // moves nothing emits nothing, so an empty object *is* idle. That keeps the
  // class in step with the pose without a second notion of "is this idle".
  //
  // The palette goes in because a tinting pose emits its colour endpoints from
  // here — see `hotVars`. `poseVars` ignores it, which is what keeps the colour
  // code out of every bundle that imports no hot expression.
  const pose = e ? e.vars(e.p) : {};
  const c = e?.tint ? e.tint(p, e.p) : p;
  return {
    // `vars` is one of the two things that can make a pose non-idle; a tint is
    // the other. Checking only the first would leave a colour-only expression
    // wearing idle's slower return clock while its geometry never moved.
    cls: rootClass(mode, !!Object.keys(pose).length || !!e?.tint),
    vars: {
      ...motionVars(t),
      // The fills, as custom properties, on every animated `blob` — tinted when
      // the pose tints and identical to the markup's own attributes when it does
      // not. Emitted unconditionally rather than only for hot poses, because the
      // stylesheet's `fill` rules have to resolve to *something* correct on an
      // blobatar wearing no expression, and a `var()` that falls back to nothing
      // makes `fill` inherit black.
      //
      // Cost is ~30 B per animated blobatar. It buys the tint being a plain
      // `transition: fill` in both directions instead of a custom property that
      // disappears mid-morph on the way out.
      "--mo-head": c.head!,
      "--mo-eye": c.eye!,
      ...pose,
    },
  };
};

/**
 * The `<svg>` contents and its motion custom properties, separately.
 *
 * For renderers that own the outer element themselves — `@blobatar/react` when
 * animating. Underscored because the shape of this object is not public API.
 */
export function _parts(name: string, opts: BlobatarOptions = {}) {
  return makeParts(style)(
    name,
    opts,
    opts.animate && motion(opts.animate, opts.expression),
  );
}

/**
 * The figure as drawing primitives, for a renderer with no markup to hand a
 * string to.
 *
 * For `@blobatar/react-native`, where the substrate is `react-native-svg` and
 * there is no `innerHTML`. Underscored on the same terms as `_parts` and
 * `_layout`: reachable through `blobatar/internal`, whose shape changes only on
 * a major together with every adapter.
 *
 * Static only, and that is not a gap in this function. The whole motion layer
 * is CSS (a stylesheet, custom properties and a class), so there is nothing
 * for `animate` to mean on a substrate that has none of the three, and a mark
 * carries no motion grouping. `expression` *does* work, because a static pose
 * bakes into the geometry before it gets here.
 *
 * `transform` is the pose's body wrap, and it is load-bearing rather than
 * decorative: `expression.bake` returns a `translate(0 N)` for any pose that
 * shifts the body, and a caller that draws the marks without it puts every
 * posed blobatar in the wrong place. It is the *only* transform: an eye's
 * rotation is baked into the points of its path by `superellipse`, not carried
 * as an attribute. Empty string when there is no pose.
 */
export function _marks(name: string, opts: BlobatarOptions = {}): {
  bg: ReturnType<typeof backdrop>;
  transform: string;
  marks: Mark[];
} {
  const { t, palette } = resolve(name, opts);
  const p = tinted(palette, opts.expression);
  const pose = posed(style.layout(t), opts);
  return {
    // Outside the pose wrap, matching `makeBlobatar`. A plate that leans and
    // scales with the creature stops being a plate.
    bg: backdrop(style, opts, p),
    transform: pose.wrap,
    marks: marks(pose.l as Layout, p),
  };
}

/**
 * The numeric layout and resolved palette, before serialization.
 *
 * Kept separate from rendering so geometric invariants — features staying
 * inside the body, the body staying inside the frame — can be asserted directly
 * rather than by parsing path data back out of the markup. Underscored because
 * the shape of this object is not public API.
 */
export function _layout(name: string, opts: BlobatarOptions = {}) {
  const { t, palette } = resolve(name, opts);
  // The cast is private and deliberately narrow: the package style has the
  // body/eyes shape the geometry tests inspect, while `Style` itself remains
  // generic for the renderer.
  const l = style.layout(t) as Layout;
  // Posed here rather than by the caller, so the geometry tests assert against
  // the same numbers the static renderer draws. Only the baked half comes back:
  // the body-level `transform` is the renderer's business, and the test that
  // cares about it (frame containment under a pose that scales the body) applies
  // the pose itself rather than parsing a matrix back out.
  const e = opts.expression;
  const posed = e ? e.bake(l as never, e.p).l : l;
  return {
    // Tinted here too, so a colour assertion can read the same numbers the
    // static renderer paints rather than the ramp they came from.
    palette: (e?.tint ? e.tint(palette as Palette, e.p) : palette) as Palette,
    ...posed,
  };
}
