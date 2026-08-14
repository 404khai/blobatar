import { describe, expect, test } from "bun:test";
import { avatar } from "../src/avatar";
import { avatarUri } from "../src/uri";
import { palette } from "../src/color";

const SEEDS = Array.from({ length: 300 }, (_, i) => `user-${i}`);

describe("output", () => {
  test("is well-formed SVG with no numeric leakage", () => {
    for (const s of SEEDS) {
      const svg = avatar(s);
      expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"');
      expect(svg).toEndWith("</svg>");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      expect(svg).not.toContain("Infinity");
    }
  });

  test("parses as XML", () => {
    // Bun ships no DOM parser, so lean on a structural check: tags balance.
    for (const s of SEEDS.slice(0, 50)) {
      const svg = avatar(s);
      const open = (svg.match(/<(?!\/)[a-z]/g) ?? []).length;
      const close = (svg.match(/<\/[a-z]/g) ?? []).length + (svg.match(/\/>/g) ?? []).length;
      expect(open).toBe(close);
    }
  });

  test("emits no ids, so many avatars on one page cannot collide", () => {
    for (const s of SEEDS.slice(0, 50)) {
      expect(avatar(s)).not.toContain("id=");
      expect(avatar(s)).not.toContain("url(#");
    }
  });

  test("stays small enough to inline", () => {
    const sizes = SEEDS.map(s => avatar(s).length);
    expect(Math.max(...sizes)).toBeLessThan(2600);
  });
});

describe("options", () => {
  test("size adds explicit dimensions", () => {
    expect(avatar("a", { size: 64 })).toContain('width="64" height="64"');
    expect(avatar("a")).not.toContain("width=");
  });

  test("background toggles the backdrop plate", () => {
    const on = avatar("a", { background: true }).match(/<path/g)!.length;
    const off = avatar("a", { background: false }).match(/<path/g)!.length;
    expect(on).toBe(off + 1);
  });

  test("each variant brings its own backdrop default", () => {
    // `blob` is transparent by default; `character` ships its squircle plate.
    expect(avatar("a", { variant: "blob" }).match(/<path/g)!.length).toBe(
      avatar("a", { variant: "blob", background: false }).match(/<path/g)!.length,
    );
    expect(avatar("a", { variant: "character" }).match(/<path/g)!.length).toBe(
      avatar("a", { variant: "character", background: false }).match(/<path/g)!.length + 1,
    );
  });

  test("hue and tone lock color while leaving shape seed-driven", () => {
    // Feature presence varies by seed, so the *set* of colors used differs.
    // What must hold is that no color outside the locked palette appears.
    const allowed = new Set(Object.values(palette(200, "blob", true, 0.5)));
    for (const s of SEEDS.slice(0, 50)) {
      for (const hex of avatar(s, { hue: 200, tone: 0.5 }).match(/#[0-9a-f]{6}/g) ?? []) {
        expect(allowed).toContain(hex);
      }
    }
    expect(avatar("alain", { hue: 200, tone: 0.5 })).not.toBe(
      avatar("bob", { hue: 200, tone: 0.5 }),
    );
  });

  test("palette overrides are applied verbatim", () => {
    expect(avatar("a", { palette: { head: "#ff0000" } })).toContain("#ff0000");
  });

  test("variants render differently from the same seed", () => {
    expect(avatar("a", { variant: "blob" })).not.toBe(avatar("a", { variant: "character" }));
  });

  test("title is escaped", () => {
    expect(avatar("a", { title: "<script>&" })).toContain("<title>&lt;script&gt;&amp;</title>");
  });
});

describe("data uri", () => {
  test("is smaller than the base64 equivalent", () => {
    const svg = avatar("alain");
    const b64 = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    expect(avatarUri("alain").length).toBeLessThan(b64.length);
  });

  test("escapes every character that would break an attribute or URL", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const uri = avatarUri(s);
      expect(uri).not.toContain('"');
      expect(uri).not.toContain("#");
      expect(uri).not.toContain("<");
    }
  });
});
