/**
 * What a consumer gets, checked the way a consumer gets it.
 *
 * Runs under **Node**, deliberately: Bun transpiles TypeScript, resolves
 * extensionless specifiers and is forgiving about module linking, so a package
 * can be thoroughly broken for the rest of the ecosystem while `bun test` stays
 * green. This file linked `dist/index.js` under Node and found exactly that —
 * a bundler bug re-exporting names out of a module that never imported them.
 *
 * Plain `.mjs` rather than `.ts` for the same reason: nothing may transpile it.
 * Every import goes through the package name, not a relative path, so the
 * `exports` map is under test too and a missing subpath fails here.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { blobatar, palette, traits, normalizeSeed } from "blobatar";
import { blobatar as blob } from "blobatar/blob";
import { blobatarUri } from "blobatar/uri";
import * as poses from "blobatar/expression";
import * as generations from "blobatar/generation";
import * as shapes from "blobatar/shapes";
import { compose, bodyFit, faceFit } from "blobatar/compose";
import { Blobatar } from "blobatar/react";

let failed = false;

const check = (name, fn) => {
  try {
    const detail = fn();
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    console.error(`✗ ${name} — ${err.message}`);
    failed = true;
  }
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const svg = (s, what) => {
  assert(typeof s === "string", `${what} did not return a string`);
  assert(s.startsWith("<svg"), `${what} did not return SVG: ${s.slice(0, 40)}`);
  assert(s.includes("</svg>"), `${what} returned truncated SVG`);
  return s;
};

check("blobatar()", () => `${svg(blobatar("alain@example.com"), "blobatar").length} chars`);
check("blobatar/blob", () => `${svg(blob("alain"), "blob").length} chars`);

check("blobatar/expression", () => {
  // Every exported pose, discovered rather than listed: a roster addition that
  // forgets the build config would ship an export that resolves to `undefined`,
  // and the whole point of this file is to run against `dist` the way an
  // installed consumer does.
  const named = Object.entries(poses).filter(([, v]) => v && typeof v === "object" && "p" in v);
  assert(named.length >= 13, `only ${named.length} poses exported`);
  for (const [name, pose] of named) {
    assert(typeof pose.vars === "function", `${name} has no serializer`);
    svg(blob("alain", { expression: pose }), `blob + ${name}`);
  }
  return `${named.length} poses — ${named.map(([n]) => n).join(", ")}`;
});

check("blobatar/generation", () => {
  // Discovered rather than listed, like the poses above: the failure this
  // catches is a new generation that never reached the build config, which
  // ships as an export resolving to `undefined`.
  const named = Object.entries(generations).filter(([, v]) => v && typeof v === "object");
  assert(named.length >= 1, "no generations exported");
  for (const [name, gen] of named) {
    assert(typeof gen.layout === "function", `${name} has no layout`);
    // The whole promise, at the one place it can be checked against the
    // published package: pinning the default renders what the default renders.
    const pinned = svg(blob("alain", { generation: gen }), `blob + ${name}`);
    if (gen.id === 1) assert(pinned === blob("alain"), "gen1 is not the default");
  }
  return named.map(([n]) => n).join(", ");
});

check("blobatar/shapes", () => {
  // Discovered rather than listed, exactly like the poses and generations
  // above, and catching the same failure: a silhouette that never reached the
  // build config ships as an export resolving to `undefined`.
  //
  // The assertion is that each one is *composable*, not merely present. A shape
  // is only worth exporting if a caller can build a generation from it, so each
  // is composed into a one-band generation of its own and rendered — which is
  // also the cheapest possible check that no shape depends on a primitive that
  // failed to make it into `dist`.
  const named = Object.entries(shapes).filter(
    ([, v]) => v && typeof v === "object" && typeof v.core === "number",
  );
  assert(named.length >= 10, `only ${named.length} shapes exported`);
  for (const [name, shape] of named) {
    assert(typeof shape.name === "string", `${name} has no name`);
    const only = { id: 900, ...compose([[shape, 1]], faceFit) };
    svg(blob("alain", { generation: only }), `blob + only ${name}`);
  }
  return `${named.length} shapes — ${named.map(([n]) => n).join(", ")}`;
});

check("blobatar/compose", () => {
  assert(typeof compose === "function", "compose is not a function");
  assert(typeof bodyFit === "function", "bodyFit is not a function");
  assert(typeof faceFit === "function", "faceFit is not a function");

  // The claim `blobatar/shapes` exists to make: a generation composed by a
  // consumer, out of the published package, renders. Two shapes and a band
  // table is the whole of what that takes.
  const mine = { id: 901, ...compose([[shapes.round, 0.5], [shapes.sun, 1]], bodyFit) };
  svg(blob("alain", { generation: mine }), "consumer-composed generation");

  // That the band table is load-bearing. Asserted against an all-`sun` table
  // rather than by comparing the two-shape one to the default: a custom
  // generation whose bands happen to select the same silhouette under the same
  // fit *should* render identically, so comparing those would be asserting a
  // coincidence. An every-seed-is-a-sun generation cannot coincide.
  const allSun = { id: 902, ...compose([[shapes.sun, 1]], bodyFit) };
  const seeds = ["alain", "alain@example.com", "user-1", "\u{1f98a}"];
  for (const seed of seeds) {
    assert(
      svg(blob(seed, { generation: allSun }), "all-sun") !== blob(seed),
      `an all-sun generation rendered ${seed} identically to the default`,
    );
  }

  // And that `fit` is load-bearing too. Scanned rather than asserted on a
  // handful of seeds, because the two fits *agree* wherever the eye cluster
  // never needed shrinking — which is most seeds. Measured at 81 of 3000 for
  // this band table, so 200 is a comfortable margin over a guaranteed hit while
  // staying cheap. A hand-picked differing seed would pass this check while
  // saying nothing about how often it is true.
  const other = { id: 903, ...compose([[shapes.round, 0.5], [shapes.sun, 1]], faceFit) };
  const scan = Array.from({ length: 200 }, (_, i) => `seed-${i}`);
  assert(
    scan.some(s => blob(s, { generation: other }) !== blob(s, { generation: mine })),
    "bodyFit and faceFit produced identical output on every seed",
  );

  return "consumer-composed generations render";
});

check("blobatar/uri", () => {
  const uri = blobatarUri("alain");
  assert(uri.startsWith("data:image/svg+xml,"), `bad data URI prefix: ${uri.slice(0, 30)}`);
  assert(!uri.includes("#"), "unescaped # would truncate the URI in CSS");
  return `${uri.length} chars`;
});

check("blobatar/react", () => {
  const html = renderToStaticMarkup(createElement(Blobatar, { name: "alain", size: 48 }));
  assert(html.includes("<img"), `static mode did not render an <img>: ${html.slice(0, 60)}`);
  assert(html.includes("data:image/svg+xml"), "static mode rendered no blobatar");
  return "renders on the server";
});

check("blobatar/react animated", () => {
  const html = renderToStaticMarkup(
    createElement(Blobatar, { name: "alain", size: 48, animate: true }),
  );
  assert(html.includes("<svg"), "animated mode did not render inline SVG");
  assert(html.includes("mo-root"), "animated mode emitted no motion class");
  return "inline SVG with motion classes";
});

/**
 * The one check here that reads the build rather than running it.
 *
 * A dev-runtime build passes every other assertion in this file: Node resolves
 * `react/jsx-dev-runtime` and `jsxDEV` works, so the component renders and the
 * smoke test goes green on a package that throws
 * `jsxDEV is not a function` for anyone bundling for production. Nothing
 * observable at runtime *here* distinguishes the two builds, so the specifier
 * itself is the assertion. See the `define` in `scripts/build.ts`.
 */
check("blobatar/react ships the production JSX runtime", () => {
  const path = createRequire(import.meta.url).resolve("blobatar/react");
  const src = readFileSync(path, "utf8");
  assert(
    !src.includes("jsx-dev-runtime") && !src.includes("jsxDEV"),
    "built with the development JSX transform — it will throw in production bundlers",
  );
  return "jsx-runtime";
});

check("named exports on the barrel", () => {
  assert(typeof palette === "function", "palette is not a function");
  assert(typeof traits === "function", "traits is not a function");
  assert(typeof normalizeSeed === "function", "normalizeSeed is not a function");
  assert(palette(200).bg?.startsWith("#"), "palette did not resolve to hex");
  return "palette, traits, normalizeSeed";
});

check("determinism", () => {
  assert(blobatar("alain") === blobatar("alain"), "same name rendered differently twice");
  assert(blobatar("alain") !== blobatar("alaim"), "one character changed nothing");
  return "same in, same out";
});

check("blobatar/motion.css", () => {
  const path = createRequire(import.meta.url).resolve("blobatar/motion.css");
  assert(existsSync(path), `resolved to a file that does not exist: ${path}`);
  return path.split("/").slice(-2).join("/");
});

process.exit(failed ? 1 : 0);
