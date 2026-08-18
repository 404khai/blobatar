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
    // Expressions are passed in as values from `blobatar/expression`, so a
    // consumer who never imports one carries no pose code at all — see the
    // "blob + happy" entry below for what one costs. Held tight deliberately:
    // this is the number that catches the option creeping back into the core.
    //
    // Raised again by 30 B — 19 of them spent — when each animated eye started
    // emitting its own `transform-origin`. That is not a feature, it is the
    // price of a Gecko bug: a `<g>`'s `fill-box` follows its children, so a
    // blink moved the eye wrapper's origin and a posed eye travelled ~30 viewBox
    // units every time it blinked. Pinning the origin in the markup is the only
    // place the fix can live, since the value is per eye. Every entry below
    // carries the same 19 B for the same reason. See `.mo-eye` in `motion.css`.
    //
    // Raised from 3700 by 33 B when expressions gained a colour channel. That is
    // the whole of what the core pays for it: one call through `tint` on the
    // expression value, on the static path, next to the `bake` call that was
    // already there. Everything that computes a colour — `hot`, `mixHex`,
    // `fromHex` — is reached only from an expression that tints, and this row
    // proves it is shaken out, because a consumer who imports none still lands
    // here rather than 200 B higher.
    //
    // Raised from 3780 by 20 B for trait overrides, and the number is the whole
    // argument for that design: making *every* axis of the blobatar configurable
    // cost one lookup and an inline clamp on the trait reader, because the
    // layout already addressed its values by key. A prop per knob would have
    // put ~25 named options and their plumbing in this row instead. Measured at
    // 1 B over before the budget bump — the branch gzips against the reader
    // that was already there.
    // Lowered from 3800 when the `character` variant was removed in 0.1.0. The
    // variant itself was never in this row — what came out was the plumbing that
    // existed only to keep two of them apart: the palette's variant-keyed ramp
    // and floor tables, the `expressive` flag, and the `variant` argument
    // threaded through `resolve`.
    // Raised from 3700 by 23 B for the generation seam — `makeBlobatar` and
    // `makeParts` reading `opts.generation` instead of closing over one style.
    // That is the whole core-side cost of the mechanism; everything else about
    // a generation is paid by the consumer who imports one, which is the point
    // of it being a passed-in value rather than an option naming a table.
    // Raised from 3730 by 147 B when gen1 stopped being a hand-written style
    // module and became `compose(bands, fit)` over `blobatar/shapes` (ADR-0007).
    // That is the honest price of the composable design on the majority case,
    // and it was measured, not estimated — the spike's +108 was measured on a
    // consumer that composed inline and skipped `generation.ts` entirely, which
    // no real default import does. The floor for that inline form is 3805; the
    // 22 B between it and this row is `generation.ts`'s own weight, which is
    // what buys `gen2` shaking out of this bundle at all.
    //
    // What it buys: `blob + gen2` fell 324 B, a second generation costs 606 B
    // instead of 1058, and ten silhouettes became importable values a caller
    // can compose. What it costs is this row, and only this row.
    name: "blob only",
    budget: 3870,
    external: [] as string[],
    source: `import { blobatar } from "../../src/blob";
             globalThis.x = blobatar(String(globalThis.seed));`,
  },
  {
    // The barrel. Costs more than `blob only` above because it also carries the
    // colour and trait utilities, which a consumer who only renders never touches.
    name: "barrel",
    budget: 3870,
    external: [],
    source: `import { blobatar } from "../../src/index";
             globalThis.x = blobatar(String(globalThis.seed));`,
  },
  {
    name: "uri",
    budget: 3960,
    external: [],
    source: `import { blobatarUri } from "../../src/uri";
             globalThis.x = blobatarUri(String(globalThis.seed));`,
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
    budget: 4850,
    external: ["react"],
    source: `import { Blobatar } from "../../src/react";
             globalThis.x = Blobatar;`,
  },
  {
    // The point of `blobatar/expression` being its own entry: importing one
    // expression must not drag the other three in. Measured against "blob only"
    // above — the delta is what a single pose actually costs.
    // Measured: +343 B for the first expression (the shared serializer and bake,
    // paid once) and +36 B for each one after it. Importing all three is 4098.
    name: "blob + happy",
    budget: 4200,
    external: [],
    source: `import { blobatar } from "../../src/blob";
             import { happy } from "../../src/expression";
             globalThis.x = blobatar(String(globalThis.seed), { expression: happy });`,
  },
  {
    /*
     * What pinning a generation costs: 16 B over "blob only", because in this
     * major `gen1` *is* the default and the bundler sees one copy of it.
     *
     * The number to watch is this one minus "blob only". It is near zero today
     * and it is what a *second* generation will actually cost, since that one
     * brings its own bands, its own `CORE` and its own decoration branches.
     * This entry exists to have been measuring it from before there was
     * anything to measure.
     *
     * One caveat this cannot see: entries are bundled standalone in `dist` (see
     * `scripts/build.ts` for why code splitting is unavailable), so a consumer
     * importing both `blobatar` and `blobatar/generation` from the published
     * package gets the shared core twice. The fixtures here bundle from source
     * and dedupe, which measures the mechanism rather than the packaging. That
     * duplication resolves itself at the next major, when `gen1` leaves the
     * core and pinning it stops overlapping with the default at all.
     */
    name: "blob + gen1",
    budget: 3880,
    external: [],
    source: `import { blobatar } from "../../src/blob";
             import { gen1 } from "../../src/generation";
             globalThis.x = blobatar(String(globalThis.seed), { generation: gen1 });`,
  },
  {
    /*
     * And what a *second* generation costs, which is the number the entry above
     * exists to be compared against.
     *
     * `blob + gen1` is 16 B over `blob only` because gen1 is this major's
     * default and the bundler sees one copy of it. This row is the same import
     * with gen2 in it, so the delta between the two is gen2's own weight: its
     * band table, its `CORE` and `face` tables, four more decoration branches,
     * and the rounded-polygon primitive that only it reaches.
     *
     * Measured: 606 B gz, down from 1084 when gen2 was its own hand-written
     * module. The drop is the six silhouettes it shares with gen1 now being
     * literally the same values rather than a second copy of them — what is
     * left is gen2's own band table, `faceFit`, the four silhouettes only it
     * draws, and the rounded-polygon primitive nothing else reaches.
     *
     * That delta is the argument for a generation being a passed-in value. A
     * consumer who never names one pays none of it — `blob only` above is
     * unmoved by this file existing at all — and a consumer who pins gen1 still
     * lands within 30 B of it. The alternative, an option naming a table, would
     * have put every future vocabulary in every bundle.
     *
     * That second property is not free, and this row is the only thing that
     * checks it. A generation is now `{ id, ...compose(bands, fit) }` — a
     * spread of a *call result*, and a bundler will not assume a call is
     * side-effect-free, so without help `gen2` survives into a bundle that only
     * ever imported `gen1`.
     *
     * The help has to be an IIFE — `/* @__PURE__ *\/ (() => ({ id, ...compose(…) }))()`
     * — and *not* the obvious `{ id, .../* @__PURE__ *\/ compose(…) }`. Both
     * were measured: the IIFE holds this row 606 B above `blob + gen1`, and the
     * annotation-on-the-call form puts the two rows at exactly 4433 B each,
     * which is the tell that gen2 is in every bundle. Same failure the old
     * `{ id: 2, ...blob2 }` namespace spread caused, same row caught it.
     */
    name: "blob + gen2",
    budget: 4490,
    external: [],
    source: `import { blobatar } from "../../src/blob";
             import { gen2 } from "../../src/generation";
             globalThis.x = blobatar(String(globalThis.seed), { generation: gen2 });`,
  },
  {
    /*
     * What composing your own generation costs — the capability `blobatar/shapes`
     * and `blobatar/compose` exist to provide (ADR-0007).
     *
     * Three silhouettes, a band table and gen1's fit. It lands *below* the
     * default import rather than above it, which is the point: a caller who
     * wants three shapes carries three, not ten.
     *
     * It is not lower still, and the reason is worth stating: `blobatar` is
     * `makeBlobatar(gen1)`, so passing `{ generation }` renders through the
     * default and this bundle carries gen1's band table and `bodyFit` too. A
     * consumer-composed generation cannot yet be the *only* one in a bundle,
     * because the factory that would let it be is not public API. That is a
     * deliberate deferral — see ADR-0007 — and it is why there is no
     * "gen2 only" row here: it is not reachable either.
     */
    name: "blob + custom",
    budget: 3900,
    external: [],
    source: `import { blobatar } from "../../src/blob";
             import { compose, bodyFit, type Band } from "../../src/styles/compose";
             import { round, organic, sun } from "../../src/styles/shapes";
             const bands: Band[] = [[round, 0.5], [organic, 0.9], [sun, 1]];
             const mine = { id: 7, ...compose(bands, bodyFit) };
             globalThis.x = blobatar(String(globalThis.seed), { generation: mine });`,
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
    // fails the gate instead of shipping. Paid once per app, not per blobatar,
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
    // bytes buys the same 3D read that per-blobatar markup could not afford.
    // Raised from 1200 for two corrections rather than features: the shared
    // `transform-box`/`transform-origin` rule that puts the body layers'
    // pivot back at the middle of the frame instead of SVG's default corner,
    // and the lean brackets around every eye scale, which stop a leaned capsule
    // squashing along screen axes. Both are what `scripts/probe-compose.ts`
    // measures; neither is optional.
    //
    // Raised from 1250 for the exaggeration pass, which is a net add of ~130 B
    // after the body-scale and lean channels came out. Three things bought it,
    // and all three are things markup would otherwise have to carry per blobatar:
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
    // Raised from 1400 for one rule, and it is the cheapest 7 bytes in the
    // file: pausing the idle loops on touch devices, where the hover rule two
    // lines above it has already pinned `--mo-amp` at zero and the loops can
    // therefore only resolve to the identity pose. Measured on a page with
    // sixty blobatars, it took style and layout in a Lighthouse trace from
    // 6.7s to 1.9s — the loops are ~8 per blobatar and most of them drive
    // registered custom properties, which recalculate on the main thread
    // rather than compositing. A grid that reads as a crowd is the case this
    // library invites, so that is the case worth being cheap in.
    budget: 1450,
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
