import { expect, test, describe } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { Blobatar as React_ } from "../src/react";
import { Blobatar as Vue_ } from "../src/vue";

/**
 * The adapters must agree.
 *
 * An adapter owns the outer element and nothing else — it adds no geometry and
 * no defaults of its own — so two adapters handed the same name and the same
 * options have to produce the same blobatar. That is the whole contract, and
 * it is not self-enforcing: Vue's runtime props table can inject values the
 * caller never passed (a type list containing `Boolean` casts an omitted prop
 * to `false`), which is a way for an adapter to change the picture while
 * looking like it only re-expresses it.
 *
 * These compare rendered output rather than the options objects, because the
 * options object is exactly the thing a props table can quietly rewrite.
 */

/**
 * Three differences between the two SSR renderers that are not differences in
 * the blobatar, normalized away so a real one cannot hide behind them:
 *
 * - Quote escaping. React writes `&#x27;`, Vue writes `&#39;`; neither survives
 *   the parse.
 * - A trailing `;` on Vue's serialized style attribute.
 * - `<!---->` placeholders where a child is `null`. These are Vue's anchors for
 *   an unkeyed children list, and they are wanted: they hold the root `<g>` at
 *   a fixed index whether or not a `<title>` is present, so toggling `title`
 *   patches in place instead of shifting every sibling up one and rebuilding
 *   the subtree the morph lives in.
 */
const normalize = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/<!---->/g, "")
    .replace(/;"/g, '"');

const react = (props: Record<string, unknown>) =>
  normalize(renderToStaticMarkup(createElement(React_ as never, props as never)));

const vue = async (props: Record<string, unknown>) =>
  normalize(await renderToString(h(Vue_ as never, props as never)));

/** The blobatar itself, out of whichever element carried it. */
const picture = (markup: string) => {
  const src = markup.match(/src="([^"]*)"/);
  return src ? decodeURIComponent(src[1]!) : markup;
};

const attr = (markup: string, name: string) =>
  markup.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

describe("the adapters render the same blobatar", () => {
  const CASES: [string, Record<string, unknown>][] = [
    // The bare call is the one that caught a real bug: with no `background`
    // prop declared default, Vue passed an explicit `false` here.
    ["nothing but a name", { name: "alain" }],
    ["a size", { name: "alain", size: 48 }],
    ["a backdrop", { name: "alain", background: "circle" }],
    ["a suppressed backdrop", { name: "alain", background: false }],
    ["a pinned hue", { name: "alain", hue: 210 }],
    ["a pinned tone", { name: "alain", tone: 0.2 }],
    ["pinned traits", { name: "alain", traits: { "body.r": 0.9 } }],
    ["a title", { name: "alain", title: "Alain" }],
    ["normalization off", { name: "  ALAIN  ", normalize: false }],
    ["contrast off", { name: "alain", contrast: false }],
  ];

  for (const [what, props] of CASES) {
    test(`static: ${what}`, async () => {
      expect(picture(await vue(props))).toBe(picture(react(props)));
    });

    test(`animated: ${what}`, async () => {
      const a = await vue({ ...props, animate: "always" });
      const b = react({ ...props, animate: "always" });
      // The motion custom properties are seeded, so they are part of the
      // picture too — comparing the whole `<svg>` covers geometry and timing.
      expect(a).toBe(b);
    });
  }
});

describe("attrs the caller passes win, in both modes", () => {
  // A caller who writes an explicit `width` or `role` is overriding what the
  // props derived. Both adapters spread caller attrs last, so both agree.
  const OVERRIDE = { name: "alain", size: 48, width: 96, height: 96, role: "presentation" };

  test("static", async () => {
    const a = await vue(OVERRIDE);
    const b = react(OVERRIDE);
    expect(attr(a, "width")).toBe("96");
    expect(attr(a, "width")).toBe(attr(b, "width")!);
    expect(attr(a, "role")).toBe(attr(b, "role")!);
  });

  test("animated", async () => {
    const props = { ...OVERRIDE, animate: "always" };
    const a = await vue(props);
    const b = react(props);
    expect(attr(a, "width")).toBe("96");
    expect(attr(a, "role")).toBe("presentation");
    expect(attr(a, "width")).toBe(attr(b, "width")!);
    expect(attr(a, "role")).toBe(attr(b, "role")!);
  });
});

describe("the adapter injects no option the caller did not pass", () => {
  /**
   * The one thing rendered output cannot check.
   *
   * Vue's props table can hand `setup` a value for a prop nobody passed — any
   * type list containing `Boolean` casts an omitted prop to `false` — and the
   * adapter forwards that into `BlobatarOptions` as though the caller had
   * asked for it. Today `background: false` happens to match what the `blob`
   * style already defaults to, so it renders identically and every comparison
   * above stays green. It would stop being invisible the moment a style ships
   * a backdrop, and it would surface as "Vue lost the backdrop" rather than as
   * anything pointing here.
   *
   * So this asserts the resolved props directly: omitted means `undefined`,
   * and the core stays the only place a default is written down.
   */
  const resolved = async (passed: Record<string, unknown>) => {
    let seen: Record<string, unknown> = {};
    const Spy = defineComponent({
      props: (Vue_ as unknown as { props: Record<string, unknown> }).props,
      setup(props) {
        seen = { ...(props as Record<string, unknown>) };
        return () => null;
      },
    });
    await renderToString(h(Spy, passed as never));
    return seen;
  };

  test("a bare call resolves to nothing but the name", async () => {
    const props = await resolved({ name: "alain" });
    expect(props).toEqual({ name: "alain" });
  });

  test("every option the caller omits stays undefined", async () => {
    const props = await resolved({ name: "alain", hue: 210 });
    const injected = Object.entries(props)
      .filter(([k]) => k !== "name" && k !== "hue")
      .filter(([, v]) => v !== undefined);
    expect(injected).toEqual([]);
  });
});
