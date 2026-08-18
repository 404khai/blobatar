import { describe, expect, test } from "bun:test";
import { _layout, _parts, blobatar } from "../src/blobatar";
import { happy } from "../src/expression";
import { gen1, type Generation } from "../src/generation";
import type { Palette } from "../src/color";
import type { Traits } from "../src/traits";
import { SEEDS } from "./golden/corpus";

/**
 * A generation that could not possibly be mistaken for the default.
 *
 * Present because every other assertion here compares gen1 against the default
 * and gen1 *is* the default in this major — so on its own that suite would pass
 * just as happily against a renderer that ignored `generation` entirely. This
 * is the one that proves the option is read.
 *
 * Written the way a real generation is — named functions, spread into the value
 * — rather than as an inline object literal. Not a style preference: an arrow
 * function in a literal gets contextually typed against `Style<Posable>`, which
 * cannot know the layout returns anything beyond eyes. Authoring it this way is
 * what lets a generation's layout have its own shape, and a test that took the
 * shortcut would not be exercising the type a real generation has to satisfy.
 */
function markerLayout(t: Traits) {
  return {
    eyes: [{ cx: 40, cy: 50, rx: 4, ry: 6, rot: 0 }],
    r: t.num("body.r", 10, 20),
  };
}

function markerRender(l: ReturnType<typeof markerLayout>, p: Palette): string {
  return `<circle cx="50" cy="50" r="${l.r.toFixed(2)}" fill="${p.head}"/>`;
}

const marker: Generation = {
  id: 99,
  ...{ layout: markerLayout, render: markerRender, background: false as const },
};

describe("generation", () => {
  test("pinning the default is the default", () => {
    // Across the golden corpus rather than a handful, because this is the
    // promise a caller pins for: not "it works", but "it is the same blobatar".
    for (const seed of SEEDS) {
      expect(blobatar(seed, { generation: gen1 })).toBe(blobatar(seed));
    }
  });

  test("pinning survives every other option", () => {
    for (const opts of [
      { size: 64 },
      { background: "squircle" as const },
      { hue: 210 },
      { tone: 0.2 },
      { expression: happy },
      { traits: { shape: 0.96 } },
      { title: "Alain" },
      { normalize: false },
    ]) {
      expect(blobatar("Alain@Example.com", { ...opts, generation: gen1 })).toBe(
        blobatar("Alain@Example.com", opts),
      );
    }
  });

  test("a generation actually replaces the layout and the renderer", () => {
    const svg = blobatar("alain", { generation: marker });
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("<path");
    // Still seeded — a generation swaps the geometry, not the hashing.
    expect(svg).not.toBe(blobatar("other", { generation: marker }));
  });

  test("the parts builder follows it too, so React animates the right one", () => {
    expect(_parts("alain", { generation: marker }).inner).toContain("<circle");
    expect(_parts("alain", { generation: gen1 }).inner).toBe(_parts("alain").inner);
  });

  test("_layout follows it, so geometry assertions can target one", () => {
    expect(_layout("alain", { generation: marker })).toMatchObject({ eyes: [{ cx: 40 }] });
  });

  test("every generation carries a distinct id", () => {
    // `blobatar/react` memoizes on `JSON.stringify` of its options, which drops
    // functions — so two generations differing only in their layout serialize
    // identically and the id is the only thing that tells them apart. A
    // duplicate here is a silently stale component, not a type error.
    const ids = [gen1.id, marker.id];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
