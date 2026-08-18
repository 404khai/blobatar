import { motionVars, rootClass, type Animate } from "./animate";
import type { Palette } from "./color";
import type { Expression } from "./expression";
import { makeBlobatar, makeParts, resolve, type BlobatarOptions } from "./render";
import type { Traits } from "./traits";
import { gen2 } from "./generation";
import type { Layout } from "./styles/compose";

export type { BlobatarOptions, Animate, Expression };

/**
 * Renders a deterministic blobatar as SVG markup.
 *
 * The same name always produces the same output within a major version. The
 * numeric ranges in `styles/compose.ts`'s `layout`, the band table the
 * generation was composed with, and the tone set are all part of that
 * contract: changing any of them reshuffles existing blobatars, which is why
 * they move together as a generation rather than one at a time.
 *
 * `gen2` is the default generation for this major, as of `2.0.0`. Pass
 * `generation` to pin one instead, and the output survives an upgrade that
 * moves the default — `{ generation: gen1 }` is how a caller keeps the
 * blobatars they had before `2.0.0`. See `generation.ts` and ADR-0008.
 */
export const blobatar = makeBlobatar(gen2);

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
 * For renderers that own the outer element themselves — `blobatar/react` when
 * animating. Underscored because the shape of this object is not public API.
 */
export function _parts(name: string, opts: BlobatarOptions = {}) {
  return makeParts(gen2)(
    name,
    opts,
    opts.animate && motion(opts.animate, opts.expression),
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
export function _layout(name: string, opts: BlobatarOptions = {}) {
  const { t, palette } = resolve(name, opts);
  // Follows `generation` like the renderers do, so a geometric invariant is
  // asserted against the generation under test rather than always against the
  // default one.
  //
  // Typed as the default generation's layout regardless, because that is what
  // every caller of this is: the geometry tests, reading `body` and `shape` off
  // the result. A generation that renamed those would need its own assertions
  // anyway, and this is underscored precisely because its shape is not a
  // promise to anyone outside this package.
  const l = (opts.generation ?? gen2).layout(t) as Layout;
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
