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

const ENTRIES = [
  {
    name: "blob only",
    budget: 3600,
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
    budget: 4800,
    external: [],
    source: `import { avatar } from "../../src/index";
             globalThis.x = avatar(String(globalThis.seed));`,
  },
  {
    name: "uri",
    budget: 4900,
    external: [],
    source: `import { avatarUri } from "../../src/uri";
             globalThis.x = avatarUri(String(globalThis.seed));`,
  },
  {
    name: "react",
    budget: 5100,
    external: ["react"],
    source: `import { Avatar } from "../../src/react";
             globalThis.x = Avatar;`,
  },
  {
    name: "traits only",
    budget: 600,
    external: [],
    source: `import { traits } from "../../src/traits";
             globalThis.x = traits(String(globalThis.seed))("hue");`,
  },
];

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

let failed = false;

for (const entry of ENTRIES) {
  const file = `${DIR}/${entry.name.replace(/\W+/g, "-")}.tsx`;
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
