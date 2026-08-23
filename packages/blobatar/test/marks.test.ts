/**
 * `_marks` and `blobatar()` draw the same figure.
 *
 * These are two traversals of one layout rather than one derived from the
 * other, and that was a deliberate trade. An emitter shared between them would
 * have made drift impossible, at the cost of an indirection on the static path
 * every web consumer is already on, and deriving one from the other taxes the
 * same path differently. See the header of `marks` in `styles/compose.ts`.
 *
 * This file is the other half of that trade. It is what turns "they cannot
 * drift" from a structural property into an asserted one, and it runs over the
 * golden corpus so it sweeps the same seeds and the same option matrix the
 * fixture does: every silhouette, every backdrop, every expression, tone
 * edges, and normalization off.
 *
 * It compares *drawing primitives*, not markup, because the two forms are not
 * meant to serialize identically: `render` groups by fill with `<g fill>`,
 * since SVG attribute inheritance makes that cheaper on the wire, while a mark
 * carries its own fill because nothing downstream of it reads a group. So the
 * markup is parsed back down to the primitives it draws, with the group fills
 * resolved onto each one, and *that* is what has to match.
 *
 * `packages/harness` asserts the same equivalence a second time and from the
 * other end, the React Native adapter against React through the real packages,
 * which is the check that would survive this file being wrong.
 */

import { expect, test } from "bun:test";
import { _marks } from "../src/blobatar";
import { blobatar } from "../src/blobatar";
import type { Mark } from "../src/styles/compose";
import { cases } from "./golden/corpus";

interface Drawn {
  bg: { d: string; fill: string } | undefined;
  transform: string;
  marks: Mark[];
}

/**
 * The figure a piece of static markup draws, as primitives.
 *
 * Hand-written rather than an XML parser, and narrow on purpose: it understands
 * exactly the five constructs `render` emits and throws on anything else. A
 * lenient parser here would silently skip an element the renderer started
 * emitting, and the test would keep passing while `_marks` lost a shape.
 */
function drawn(markup: string): Drawn {
  const body = markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const fills: string[] = [];
  const marks: Mark[] = [];
  let bg: Drawn["bg"];
  let transform = "";
  let i = 0;

  const TOKEN =
    /<title>[\s\S]*?<\/title>|<g fill="([^"]*)">|<g transform="([^"]*)">|<\/g>|<path d="([^"]*)"(?: fill="([^"]*)")?\/>|<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)"\/>/g;

  for (let m = TOKEN.exec(body); m; m = TOKEN.exec(body)) {
    if (m.index !== i) throw new Error(`unparsed markup at ${i}: ${body.slice(i, m.index)}`);
    i = m.index + m[0].length;

    if (m[0].startsWith("<title")) continue;
    if (m[1] !== undefined) { fills.push(m[1]); continue; }
    if (m[2] !== undefined) { transform = m[2]; continue; }
    if (m[0] === "</g>") { fills.pop(); continue; }

    if (m[3] !== undefined) {
      // A path carrying its own fill is the backdrop: it is the only thing
      // `render` draws outside a `<g fill>`, and the only thing drawn before
      // the pose wrap opens.
      if (m[4] !== undefined) bg = { d: m[3], fill: m[4] };
      else marks.push({ kind: "path", d: m[3], fill: fills[fills.length - 1]! });
      continue;
    }

    marks.push({
      kind: "circle",
      cx: Number(m[5]), cy: Number(m[6]), r: Number(m[7]),
      fill: fills[fills.length - 1]!,
    });
  }

  if (i !== body.length) throw new Error(`unparsed markup at end: ${body.slice(i)}`);
  return { bg, transform, marks };
}

test("the parser refuses markup it does not fully understand", () => {
  expect(() => drawn(`<svg><rect x="0"/></svg>`)).toThrow();
});

test("_marks draws what blobatar() draws, over the golden corpus", () => {
  let n = 0;
  for (const [key, markup] of cases()) {
    // The corpus keys carry their options in a label after a NUL, and the
    // options themselves are not recoverable from it, so the seeds are swept
    // here and the option matrix below, against the same generator.
    if (key.includes("\0")) continue;
    n++;
    expect(drawn(markup)).toEqual(_marks(key) as never);
  }
  // A guard against the loop above quietly matching nothing, which is how a
  // corpus refactor turns this file into a test that asserts zero cases.
  expect(n).toBeGreaterThan(500);
});

test("_marks draws what blobatar() draws, under every option", () => {
  const OPTS = [
    { background: false as const },
    { background: "square" as const },
    { background: "circle" as const },
    { background: "squircle" as const },
    { hue: 0 },
    { tone: 0.999 },
    { size: 64 },
    { title: "Alain" },
    { normalize: false },
    { contrast: false },
    { traits: { shape: 0.965 } },
    { palette: { head: "#123456" } },
  ];
  for (const opts of OPTS) {
    expect(drawn(blobatar("alain", opts))).toEqual(_marks("alain", opts) as never);
  }
});

test("a pose reaches the marks, transform and tint included", async () => {
  const { happy, mad } = await import("../src/expression");

  // Geometry: `happy` moves the body, so the wrap has to survive into `_marks`.
  // A caller that drew the marks without it would put the figure in the
  // wrong place, silently and only for posed blobatars.
  const posed = _marks("alain", { expression: happy });
  expect(posed).toEqual(drawn(blobatar("alain", { expression: happy })) as never);
  expect(posed.transform).not.toBe("");
  expect(_marks("alain").transform).toBe("");

  // Colour: `mad` tints, and the tint has to be on the marks rather than left
  // to a stylesheet, because there is no stylesheet on this path.
  const tinted = _marks("alain", { expression: mad });
  expect(tinted).toEqual(drawn(blobatar("alain", { expression: mad })) as never);
  // The head, which is the half `mad` tints. Its eyes keep the seed's ink.
  expect(tinted.marks[0]!.fill).not.toBe(_marks("alain").marks[0]!.fill);
});
