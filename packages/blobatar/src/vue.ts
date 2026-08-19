import {
  computed,
  defineComponent,
  h,
  type CSSProperties,
  type PropType,
} from "vue";
import { serializeVars, type Animate } from "./animate";
import { _parts, type BlobatarOptions } from "./blobatar";
import type { Palette } from "./color";
import type { Expression } from "./expression";
import type { TraitOverrides } from "./traits";
import { blobatarUri } from "./uri";

/**
 * Vue 3 adapter: the same two rendering modes as `blobatar/react`, behind the
 * same props.
 *
 * Static blobatars render as an `<img>`: a list of a few hundred is exactly the
 * case where you do not want extra DOM nodes per screen, and nothing here uses
 * `currentColor`, so inline SVG would buy nothing.
 *
 * Animated blobatars cannot. Content inside an `<img>` is an isolated,
 * non-interactive document — `:hover` never fires inside it and host-page CSS
 * cannot reach the shapes — so `animate` switches to inline SVG and costs
 * roughly a dozen nodes per blobatar. That trade is the reason animation is
 * opt-in rather than a default. See `react.tsx` for the full argument; none of
 * it is framework-specific.
 *
 * A render function rather than a template or an SFC: the same `setup()` then
 * works in `<script setup>`, in a plain `setup()` return, and under
 * `defineComponent` — no template compiler in the loop, and no SFC pre-step for
 * a consumer to configure. Vue's `h()` renders real SVG elements natively, so
 * there is no JSX runtime to externalize either.
 *
 * Everything not declared as a prop — `class`, `style`, `alt`, `aria-*`,
 * event listeners, `data-*` — flows through Vue's `attrs` onto whichever
 * element the mode renders, the same way `rest` spreads onto the DOM node in
 * the React adapter.
 */
export const Blobatar = defineComponent({
  name: "Blobatar",
  // Attrs are placed by hand on whichever element the mode renders; the
  // default automatic inheritance can only target one fixed element, so it is
  // off. The two branches handle their own merge.
  inheritAttrs: false,
  props: {
    /** Who the blobatar is for. A username, a display name, an email — any
     *  string, and the same string always renders the same blobatar. */
    name: { type: String, required: true },
    /** Emits width/height attributes. Omit to let CSS size it. */
    size: { type: Number },
    /** Overrides the default backdrop. `false` renders transparent. */
    background: {
      type: [Boolean, String] as PropType<BlobatarOptions["background"]>,
    },
    /** Overrides specific palette entries. */
    palette: { type: Object as PropType<Palette> },
    /** Locks the hue in degrees, so the name drives shape only. */
    hue: { type: Number },
    /** Locks the tone as a 0–1 position in the swatch set. */
    tone: { type: Number },
    /** Pins individual traits, so the name drives only what you leave out. */
    traits: { type: Object as PropType<TraitOverrides> },
    /** Applies NFC + trim + lowercase to the name. Default true. */
    normalize: { type: Boolean, default: true },
    /** Enforces the minimum contrast ratios. Default true. */
    contrast: { type: Boolean, default: true },
    /** Adds a `<title>` for screen readers. */
    title: { type: String },
    /**
     * Idle animation. Off by default; `"hover"` or `"always"`.
     *
     * Requires `import "blobatar/motion.css"`, and switches the rendering mode
     * to inline SVG — the same contract as `blobatar/react`.
     *
     * Boolean is accepted alongside the two modes for template shorthand
     * (`<Blobatar animate />`), which Vue coerces to `true`; it means the same
     * as `"hover"`.
     */
    animate: { type: [String, Boolean] as PropType<Animate | false> },
    /** Which pose the blobatar holds. Import one from `blobatar/expression`. */
    expression: { type: Object as PropType<Expression> },
  },
  setup(props, { attrs }) {
    /**
     * The options object, rebuilt whenever any option changes.
     *
     * React's adapter memoizes on a serialized dependency string because its
     * hooks have no way to track each option individually. Vue does not need
     * that dance at all: `computed` tracks the props it reads by reference, so
     * an option that changed recomputes and one that did not invalidates
     * nothing. That is the correct granularity, which the serialized string
     * was approximating.
     */
    const opts = computed<BlobatarOptions>(() => ({
      size: props.size,
      background: props.background,
      palette: props.palette,
      hue: props.hue,
      tone: props.tone,
      normalize: props.normalize,
      contrast: props.contrast,
      title: props.title,
      expression: props.expression,
      traits: props.traits,
    }));

    const animated = computed(() => !!props.animate);

    const src = computed(() =>
      animated.value ? "" : blobatarUri(props.name, opts.value),
    );

    const parts = computed(() =>
      animated.value
        ? _parts(props.name, {
            ...opts.value,
            // `true` (template shorthand) means the same as "hover".
            animate: props.animate === "always" ? "always" : "hover",
          })
        : null,
    );

    return () => {
      const o = opts.value;
      const p = parts.value;

      if (p) {
        const { style: userStyle, ...svgAttrs } = attrs as {
          style?: CSSProperties | string;
          [key: string]: unknown;
        };
        // The seeded motion custom properties go on the same element the
        // stylesheet reads them from. Vue accepts style as a string or an
        // object; a string cannot be merged by spread, so it is concatenated —
        // user declarations last, so they win over the seed, exactly like the
        // object path and like React's `{ ...vars, ...style }`.
        const vars = p.vars ?? {};
        const style =
          typeof userStyle === "string"
            ? serializeVars(vars) + (userStyle ? `;${userStyle}` : "")
            : { ...vars, ...(userStyle ?? {}) };

        return h(
          "svg",
          {
            ...svgAttrs,
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: "0 0 100 100",
            ...(o.size !== undefined ? { width: o.size, height: o.size } : {}),
            // With a `title` the markup carries a `<title>`, so this is a
            // labelled image; without one it is decoration and should be
            // skipped entirely — the same call `alt=""` makes on the `<img>`
            // path. Never both: a `role="img"` that is also `aria-hidden`
            // just contradicts itself.
            role: o.title ? "img" : undefined,
            "aria-hidden": o.title ? undefined : true,
            style,
          },
          [
            /*
             * Three real children rather than one innerHTML blob, for the same
             * reason as the React adapter: `<title>` names the element it is
             * the first child of, the backdrop must sit outside the hover-lift
             * or the plate scales with the creature, and only the root `<g>`'s
             * class varies at runtime.
             *
             * Vue needs no memoized `{__html}` object here. The VNode diff
             * compares prop values, and `inner` never varies with the
             * expression — so an expression change is attribute writes on the
             * root and the DOM below survives, which is what the morph needs
             * to exist at all.
             */
            o.title ? h("title", o.title) : null,
            p.bg ? h("path", { d: p.bg.d, fill: p.bg.fill }) : null,
            h("g", { class: p.cls, innerHTML: p.inner }),
          ],
        );
      }

      const { alt, ...imgAttrs } = attrs as {
        alt?: string;
        [key: string]: unknown;
      };
      return h("img", {
        src: src.value,
        ...(o.size !== undefined ? { width: o.size, height: o.size } : {}),
        alt: alt ?? o.title ?? "",
        ...imgAttrs,
      });
    };
  },
});
