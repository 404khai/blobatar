/**
 * `@blobatar/react-native` draws the same blobatar as `@blobatar/react`.
 *
 * The roster in `adapters.test.ts` compares markup to markup, and this adapter
 * cannot join it. Two of that file's assumptions are false here: there is no
 * `<img>` and no `data:image/svg+xml`, because React Native's `<Image>` does not
 * decode SVG, and there is no `animate`, because the motion layer is a
 * stylesheet and this platform has none — so every animated case in that table
 * describes something that does not exist on this one.
 *
 * That is the ADR-0010 shape: the guarantee is owed in full, and the instrument
 * has to differ. What is *not* different is the matrix — both files read the
 * same `CASES`, because two adapters compared over two lists agree about
 * whatever they happen to share.
 *
 * The comparison is by drawing primitive rather than by string, and that is
 * forced rather than convenient. The two renderers group differently on
 * purpose: core's string emits `<g fill="…">` because SVG attribute inheritance
 * makes that cheaper on the wire, while a mark carries its own fill because
 * nothing in `react-native-svg` reads a group. Comparing raw markup would fail
 * on every case by design. So both sides are parsed down to the ordered list of
 * things actually drawn, with group fills resolved onto each one, and that is
 * what has to match.
 *
 * `react-native-svg` itself is stubbed — see `react-native-stub.ts` for what
 * that does and does not prove.
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Blobatar as React_ } from "@blobatar/react";
import { Blobatar as Native_ } from "@blobatar/react-native";
import { CASES } from "./cases";

/** One thing drawn, with its fill resolved through any enclosing group. */
type Prim = Record<string, string>;

/**
 * The figure a piece of SVG markup draws.
 *
 * Deliberately strict: it understands exactly the elements these two renderers
 * emit and throws on anything else. A lenient reader would silently skip an
 * element one side started drawing and the other did not, which is the precise
 * failure this file exists to catch.
 */
function figure(markup: string): { transform: string; prims: Prim[] } {
  const body = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const fills: string[] = [];
  const prims: Prim[] = [];
  let transform = "";
  let i = 0;

  const TOKEN =
    /<title>[\s\S]*?<\/title>|<g fill="([^"]*)"><\/g>|<g([^>]*)>|<\/g>|<(path|circle)([^>]*?)\/?>(?:<\/(?:path|circle)>)?/g;

  for (let m = TOKEN.exec(body); m; m = TOKEN.exec(body)) {
    if (m.index !== i) throw new Error(`unparsed at ${i}: ${body.slice(i, m.index)}`);
    i = m.index + m[0].length;

    if (m[0].startsWith("<title")) continue;
    if (m[0] === "</g>") { fills.pop(); continue; }

    if (m[2] !== undefined) {
      const attrs = Object.fromEntries(
        [...m[2].matchAll(/(\w[\w-]*)="([^"]*)"/g)].map(a => [a[1]!, a[2]!]),
      );
      // A `<g>` carries either a fill (core's grouping) or the pose transform,
      // never both — and the stack has to be pushed either way or the `</g>`
      // that closes a transform group would pop somebody else's fill.
      if (attrs.transform) transform = attrs.transform;
      fills.push(attrs.fill ?? fills[fills.length - 1] ?? "");
      continue;
    }

    const attrs = Object.fromEntries(
      [...m[4]!.matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1]!, a[2]!]),
    );
    prims.push({
      tag: m[3]!,
      ...attrs,
      fill: attrs.fill ?? fills[fills.length - 1] ?? "",
    });
  }

  if (i !== body.length) throw new Error(`unparsed at end: ${body.slice(i)}`);
  return { transform, prims };
}

/** React's static blobatar lives inside the `src` of an `<img>`. */
const fromReact = (props: Record<string, unknown>) => {
  const markup = renderToStaticMarkup(createElement(React_ as never, props as never));
  const src = markup.match(/src="([^"]*)"/);
  if (!src) throw new Error(`no data URI in React's output: ${markup}`);
  const uri = decodeURIComponent(src[1]!.replace(/&#x27;/g, "'"));
  // `blobatarUri` swaps every `"` for a `'` so the markup survives inside an
  // attribute, and percent-encodes the handful of characters that would not.
  return figure(uri.replace(/^data:image\/svg\+xml,/, "").replace(/'/g, '"'));
};

const fromNative = (props: Record<string, unknown>) =>
  figure(renderToStaticMarkup(createElement(Native_ as never, props as never)));

/**
 * `size` is required on this adapter and optional everywhere else, so every
 * case gains one. It changes no geometry — it is `width`/`height` on the outer
 * element, which `figure` never reads — so the comparison is unaffected.
 */
const sized = (props: Record<string, unknown>) => ({ size: 40, ...props });

test("the parser refuses markup it does not fully understand", () => {
  expect(() => figure(`<svg><rect x="0"/></svg>`)).toThrow();
});

/**
 * Agreement is not enough on its own — two adapters that both render nothing
 * agree perfectly, which is how an empty Preact adapter once passed a clean
 * typecheck and a green suite. So this runs before any comparison.
 */
test("@blobatar/react-native renders a blobatar at all", () => {
  const { prims } = fromNative({ name: "alain", size: 40 });
  expect(prims.length).toBeGreaterThan(2);
  expect(prims.every(p => p.tag === "path" || p.tag === "circle")).toBe(true);
  expect(prims.every(p => p.fill?.startsWith("#"))).toBe(true);
});

test("it draws onto react-native-svg elements, not into a string", () => {
  const markup = renderToStaticMarkup(
    createElement(Native_ as never, { name: "alain", size: 40 } as never),
  );
  // The stub renames the components and touches nothing else, so a real `<svg>`
  // root with real children here is the adapter having built elements. An
  // `SvgXml`-style implementation would show up as an unrendered `xml` prop.
  expect(markup).toStartWith("<svg");
  expect(markup).not.toContain("xml=");
});

describe("it draws what @blobatar/react draws", () => {
  for (const [what, props] of CASES) {
    test(what, () => {
      expect(fromNative(sized(props))).toEqual(fromReact(sized(props)));
    });
  }

  // Not in `CASES` because the other adapters take expressions as imported
  // values and the shared table is plain data. It belongs here regardless:
  // `expression` is the one part of the motion story that does survive to this
  // platform, and the pose's body `transform` is the thing most likely to be
  // dropped silently — a posed blobatar would simply render in the wrong place.
  test("a pose, transform included", async () => {
    const { happy, mad } = await import("blobatar/expression");
    for (const expression of [happy, mad]) {
      const props = { name: "alain", size: 40, expression };
      expect(fromNative(props)).toEqual(fromReact(props));
    }
    expect(fromNative({ name: "alain", size: 40, expression: happy }).transform).not.toBe("");
  });
});

describe("the caller's props win", () => {
  /**
   * Read from the stub's recorder rather than from markup, because `react-dom`
   * drops an unknown attribute whose value is a boolean — and
   * `accessibilityElementsHidden={true}` is exactly that. Asserting against
   * HTML here would be asserting against react-dom's attribute rules instead of
   * against the adapter. See the stub's header.
   */
  const root = async (props: Record<string, unknown>) => {
    const rns = (await import("react-native-svg")) as unknown as {
      received: Record<string, unknown>[];
    };
    rns.received.length = 0;
    renderToStaticMarkup(createElement(Native_ as never, props as never));
    expect(rns.received).toHaveLength(1);
    return rns.received[0]!;
  };

  test("size sets the outer dimensions", async () => {
    const a = await root({ name: "alain", size: 48 });
    expect(a.width).toBe(48);
    expect(a.height).toBe(48);
    expect(a.viewBox).toBe("0 0 100 100");
  });

  test("an explicit width overrides what size derived", async () => {
    // The same rule `adapters.test.ts` asserts across the DOM adapters: the
    // caller's own props spread last.
    const a = await root({ name: "alain", size: 48, width: 96 });
    expect(a.width).toBe(96);
  });

  test("a title becomes the accessibility label, not an element", async () => {
    const a = await root({ name: "alain", size: 40, title: "Alain" });
    // `react-native-svg` has no `<title>`, so the label has to land on the root
    // as an accessibility prop or it is lost entirely.
    expect(a.accessibilityLabel).toBe("Alain");
    expect(a.accessibilityRole).toBe("image");
    expect(a.accessible).toBe(true);
    expect(a.accessibilityElementsHidden).toBeUndefined();
    expect(
      renderToStaticMarkup(
        createElement(Native_ as never, { name: "alain", size: 40, title: "Alain" } as never),
      ),
    ).not.toContain("<title>");
  });

  test("without a title the tree is hidden on both platforms", async () => {
    const a = await root({ name: "alain", size: 40 });
    // Not aliases: one is iOS and one is Android, and setting only one leaves
    // the other platform reading a dozen unnamed paths aloud.
    expect(a.accessibilityElementsHidden).toBe(true);
    expect(a.importantForAccessibility).toBe("no-hide-descendants");
    expect(a.accessibilityLabel).toBeUndefined();
    expect(a.accessibilityRole).toBeUndefined();
  });

  test("an explicit label beats the one title derived", async () => {
    const a = await root({ name: "alain", size: 40, title: "Alain", accessibilityLabel: "Somebody" });
    expect(a.accessibilityLabel).toBe("Somebody");
  });

  test("no option the caller omitted is invented", async () => {
    // The assertion `adapters.test.ts` makes against Vue's props table, made
    // here against a plain function component. Nothing but the name should
    // survive into what core is asked to render — and `traits` in particular
    // must never reach the native element, where the view bridge has no idea
    // what it is.
    const a = await root({ name: "alain", size: 40 });
    for (const k of ["traits", "palette", "expression", "hue", "tone", "background"]) {
      expect(a[k]).toBeUndefined();
    }
  });
});
