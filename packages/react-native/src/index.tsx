/**
 * `@blobatar/react-native`, the React Native and Expo adapter.
 *
 * ## Why this one holds a component when `@blobatar/react` does not
 *
 * `@blobatar/react` is an alias: the component still lives in `blobatar/react`
 * until v3, because that subpath shipped with consumers and core cannot depend
 * on a package that peer-depends on core (ADR-0009). Nothing analogous is true
 * here. There is no `blobatar/react-native` subpath and there never will be.
 * ADR-0009 freezes core's optional peer list at `react` and `vue`, and the
 * moment a third adapter subpath appears the peer list resumes growing and the
 * reason for splitting is gone. So this package holds the real implementation
 * from its first release, the way Solid and Preact do.
 *
 * ## Why it draws elements rather than parsing a string
 *
 * Neither of the two rendering modes the DOM adapters use survives the port.
 * The static one is an `<img>` carrying a `data:image/svg+xml` URI, and React
 * Native's `<Image>` does not decode SVG. The animated one hands `parts.inner`
 * to `dangerouslySetInnerHTML`, and there is no `innerHTML` here at all.
 *
 * `react-native-svg` ships an `SvgXml` that would parse `blobatar()`'s string
 * at runtime, and that was the obvious shape and the wrong one: it puts an XML
 * parser between the renderer and the screen, which is a place the picture can
 * change, and ADR-0009 is explicit that an adapter adds no geometry of its own.
 * So core grew `_marks`, the same figure as drawing primitives, and this file
 * maps them onto elements. What crosses the boundary is data core produced,
 * not markup something re-interpreted.
 *
 * Every silhouette in gen2 draws with `<path>` and `<circle>` and nothing else:
 * no gradients, no filters, no masks, no `currentColor`. That is what makes the
 * mapping total rather than approximate.
 */

import { useMemo } from "react";
import { _marks, type BlobatarOptions } from "blobatar/internal";
import Svg, { Circle, G, Path, type SvgProps } from "react-native-svg";

export type BlobatarProps = {
  /**
   * Who the blobatar is for. A username, a display name, an email, a bot's
   * handle, a user id. Any string, and the same string always renders the
   * same blobatar.
   */
  name: string;
  /**
   * How big to draw it, in points. **Required here, and optional in every
   * other adapter.**
   *
   * On the web, omitting it emits no `width`/`height` and lets CSS size the
   * element, and the viewBox scales to whatever the page decides. React Native has
   * no such fallback, so an unsized `<Svg>` is at best ambiguous and at worst
   * zero pixels of nothing.
   *
   * The alternative was defaulting it here, and that is the one thing ADR-0009
   * says an adapter may never do: a default size is a default that changes the
   * picture, and the core is the only place a default is written down. Making
   * it required moves the platform difference to a compile error at the call
   * site, where it is visible, instead of a blank square at runtime.
   */
  size: number;
} & Omit<BlobatarOptions, "animate" | "size"> &
  /**
   * `title` is dropped from the passthrough because `SvgProps` declares one of
   * its own and it is not this one. Ours is the screen-reader label every
   * adapter takes, and it is mapped onto React Native's accessibility props
   * below rather than onto an element, because `react-native-svg` has no
   * `<title>`.
   *
   * `viewBox` is dropped because the geometry is drawn in a fixed 100×100 space
   * and a caller who changes it gets a cropped blobatar, not a resized one:
   * `size` is the prop for that. `children` because there is nothing to put
   * inside a blobatar.
   */
  Omit<SvgProps, "viewBox" | "children" | "title">;

/**
 * There is no `animate` prop, and its absence is the API rather than an
 * oversight.
 *
 * Blobatar's idle motion is a stylesheet: `motion.css`, a root class, and a
 * dozen seeded custom properties the CSS reads. React Native has no stylesheet,
 * no custom properties and no CSS transitions, so there is nothing here for
 * `animate` to switch on. Re-expressing the motion spec against Reanimated
 * would make it exist twice, in two languages, drifting, which is the failure
 * ADR-0009 refuses everywhere else.
 *
 * So the prop is absent from the type instead of accepted and ignored. Passing
 * `animate` is a compile error naming this package, which is the cheapest place
 * to learn it.
 *
 * `expression` is a different matter and works fully: a static pose bakes into
 * the geometry before it reaches the marks, which is why it survives here for
 * the same reason it survives in the string API. What is missing is only the
 * *morph* between poses, which was always the part that needed CSS.
 */
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
  expression,
  traits,
  ...rest
}: BlobatarProps) {
  // Pulled out explicitly like every other option, because what is left in
  // `rest` goes straight onto the `<Svg>`, and `traits` spread onto a native
  // component is a prop the view bridge has no idea what to do with.
  //
  // `size` and `title` are deliberately not in here: `_marks` reads neither.
  // Size is an attribute on the outer element, which is this file's business,
  // and the label has nowhere to go in a mark.
  const opts = { background, palette, hue, tone, normalize, contrast, expression, traits };

  const dep = JSON.stringify([seed, opts]);
  const figure = useMemo(
    () => _marks(seed, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dep],
  );

  const body = figure.marks.map((m, i) =>
    m.kind === "circle" ? (
      <Circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} />
    ) : (
      <Path key={i} d={m.d} fill={m.fill} />
    ),
  );

  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      /*
        The label, and the call the DOM adapters make with `role`/`aria-hidden`,
        made again in React Native's vocabulary. With a `title` this is an image
        with a name; without one it is decoration, and a screen reader that
        walks into a dozen unnamed paths is worse than one that never sees them.

        Both platform spellings of "skip this subtree" are set, because they are
        not aliases: `accessibilityElementsHidden` is iOS and
        `importantForAccessibility` is Android, and setting one leaves the other
        platform reading the shapes.
      */
      accessible={title ? true : undefined}
      accessibilityRole={title ? "image" : undefined}
      accessibilityLabel={title}
      accessibilityElementsHidden={title ? undefined : true}
      importantForAccessibility={title ? undefined : "no-hide-descendants"}
      // Last, so a caller who writes an explicit `width` or `accessibilityLabel`
      // overrides what the props derived. The same rule every other adapter
      // follows, and one `packages/harness` asserts across all of them.
      {...rest}
    >
      {/*
        Outside the pose wrap, matching every other renderer: a plate that leans
        and scales with the creature stops being a plate.
      */}
      {figure.bg ? <Path d={figure.bg.d} fill={figure.bg.fill} /> : null}
      {/*
        `transform` is the pose's body wrap and it is load-bearing rather than
        decorative. `expression.bake` returns a `translate(0 N)` for any pose
        that shifts the body, and drawing the marks without it puts every posed
        blobatar in the wrong place. It is the only transform in the figure: an
        eye's rotation is baked into the points of its path, not carried as an
        attribute.
      */}
      {figure.transform ? <G transform={figure.transform}>{body}</G> : body}
    </Svg>
  );
}
