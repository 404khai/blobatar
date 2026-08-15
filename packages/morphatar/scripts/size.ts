/**
 * Bundle size gate.
 *
 * Measured through synthetic consumers rather than by building the barrel
 * directly — a library entry with no importer tree-shakes to nothing, which
 * reports a flattering number that no real app ever sees.
 *
 * Budgets are per entry point. The core budget is the one that matters: it is
 * what stops a convenience import from quietly pulling in the React adapter, or
 * a palette tweak from doubling the color code.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const DIR = "scripts/.fixtures";

const ENTRIES: {
  name: string;
  budget: number;
  external: string[];
  source: string;
  /** Entry file extension. Defaults to a TSX consumer. */
  ext?: string;
}[] = [
  {
    // Expressions are passed in as values from `morphatar/expression`, so a
    // consumer who never imports one carries no pose code at all — see the
    // "blob + happy" entry below for what one costs. Held tight deliberately:
    // this is the number that catches the option creeping back into the core.
    //
    // Raised from 3700 by 33 B when expressions gained a colour channel. That is
    // the whole of what the core pays for it: one call through `tint` on the
    // expression value, on the static path, next to the `bake` call that was
    // already there. Everything that computes a colour — `hot`, `mixHex`,
    // `fromHex` — is reached only from an expression that tints, and this row
    // proves it is shaken out, because a consumer who imports none still lands
    // here rather than 200 B higher.
    name: "blob only",
    budget: 3750,
    external: [] as string[],
    source: `import { avatar } from "../../src/blob";
             globalThis.x = avatar(String(globalThis.seed));`,
  },
  {
    name: "character",
    budget: 3650,
    external: [],
    source: `import { avatar } from "../../src/character";
             globalThis.x = avatar(String(globalThis.seed));`,
  },
  {
    name: "both",
    budget: 4850,
    external: [],
    source: `import { avatar } from "../../src/index";
             globalThis.x = avatar(String(globalThis.seed));`,
  },
  {
    name: "uri",
    budget: 4950,
    external: [],
    source: `import { avatarUri } from "../../src/uri";
             globalThis.x = avatarUri(String(globalThis.seed));`,
  },
  {
    // Carries both rendering modes: the <img> path and the inline-SVG path that
    // `animate` needs. The inline path is ~570 B of that — the motion traits,
    // the parts builder, and the second branch of the component.
    //
    // Raised from 5650 by 80 B when the animated branch stopped being a single
    // `dangerouslySetInnerHTML` and became three children: a `<title>`, the
    // backdrop as a real `<path>`, and the root `<g>` whose class React now
    // owns. That last one is the point — the root class varies with the
    // expression, and a varying class inside an innerHTML string replaces the
    // subtree on every change, which costs the morph and restarts every idle
    // animation under it. 80 B is the price of the transition existing.
    //
    // Raised again from 5750 by 64 B for the colour channel: the 33 B the core
    // pays (see "blob only") plus the animated path emitting the resolved fills
    // as `--mo-head`/`--mo-eye`. Those go out on every animated `blob`, tinted
    // or not, so the stylesheet's `fill` rules always resolve to something
    // correct — a `var()` with nothing behind it makes `fill` inherit black.
    name: "react",
    budget: 5830,
    external: ["react"],
    source: `import { Avatar } from "../../src/react";
             globalThis.x = Avatar;`,
  },
  {
    // The point of `morphatar/expression` being its own entry: importing one
    // expression must not drag the other three in. Measured against "blob only"
    // above — the delta is what a single pose actually costs.
    // Measured: +343 B for the first expression (the shared serializer and bake,
    // paid once) and +36 B for each one after it. Importing all three is 4098.
    name: "blob + happy",
    budget: 4100,
    external: [],
    source: `import { avatar } from "../../src/blob";
             import { happy } from "../../src/expression";
             globalThis.x = avatar(String(globalThis.seed), { expression: happy });`,
  },
  {
    name: "traits only",
    budget: 600,
    external: [],
    source: `import { traits } from "../../src/traits";
             globalThis.x = traits(String(globalThis.seed))("hue");`,
  },
  {
    // Bundled rather than gzipped straight off disk, so a syntax error here
    // fails the gate instead of shipping. Paid once per app, not per avatar,
    // which is the whole reason the keyframes are not inlined into each SVG.
    name: "motion css",
    // Raised again from 950 for the expression layer: nine `@property`
    // registrations, the pose terms folded into the existing keyframes, and the
    // reduced-motion block restating the pose statically (an expression must
    // survive reduced motion — only the morph is removed). The registrations
    // look like the expensive part and are not; nine near-identical blocks
    // gzip to almost nothing, which is the same effect the wrap chains rely on.
    //
    // Previously raised from 800 for the wrap layer (§4.7), which no smaller form fits:
    // foreshortening alone measured 854, and the two obvious factorings both
    // came out *larger* than writing the chains out (see `@keyframes mo-wrap`).
    // Worth it here and nowhere else — this file is paid once per app, so 180
    // bytes buys the same 3D read that per-avatar markup could not afford.
    // Raised from 1200 for two corrections rather than features: the shared
    // `transform-box`/`transform-origin` rule that puts the body layers'
    // pivot back at the middle of the frame instead of SVG's default corner,
    // and the lean brackets around every eye scale, which stop a leaned capsule
    // squashing along screen axes. Both are what `scripts/probe-compose.ts`
    // measures; neither is optional.
    //
    // Raised from 1250 for the exaggeration pass, which is a net add of ~130 B
    // after the body-scale and lean channels came out. Three things bought it,
    // and all three are things markup would otherwise have to carry per avatar:
    //
    //  - Per-eye asymmetry. Three registrations and four derived values on
    //    `.mo-eye`, replacing the only other option — per-eye inline styles,
    //    which are forbidden because nothing in `parts.inner` may vary with the
    //    expression.
    //  - The tremor: one registration and a four-stop keyframe.
    //  - The two `fill` rules, which is how a hot pose reaches a colour that
    //    lives in a presentation attribute CSS cannot read.
    //
    // The transition lists got *shorter* despite three more channels, because
    // the duration and easing lists are now stated once in `--mo-md`/`--mo-me`
    // instead of being restated in full by the `:hover` rule.
    budget: 1400,
    external: [],
    ext: "css",
    source: `@import "../../src/motion.css";`,
  },
];

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

let failed = false;

for (const entry of ENTRIES) {
  const file = `${DIR}/${entry.name.replace(/\W+/g, "-")}.${entry.ext ?? "tsx"}`;
  writeFileSync(file, entry.source);

  const build = await Bun.build({
    entrypoints: [file],
    target: "browser",
    minify: true,
    external: entry.external,
  });

  if (!build.success) {
    console.error(`✗ ${entry.name} failed to build`);
    for (const log of build.logs) console.error(log);
    failed = true;
    continue;
  }

  const raw = await build.outputs[0]!.arrayBuffer();
  const gz = Bun.gzipSync(new Uint8Array(raw)).byteLength;
  const ok = gz <= entry.budget;
  failed ||= !ok;

  console.log(
    `${ok ? "✓" : "✗"} ${entry.name.padEnd(13)} ${String(gz).padStart(5)} B gz` +
      ` / ${String(entry.budget).padStart(5)} B  (${Math.round((gz / entry.budget) * 100)}%)`,
  );
}

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
