/**
 * Publish build for the Angular adapter.
 *
 * Nothing of `blobatar` is inlined. The external list is the whole point of the
 * split: core is a peer dependency resolved at the consumer's install, so an
 * Angular app and a React app on the same page share one renderer rather than
 * carrying a private copy each.
 */

import { rmSync } from "node:fs";
import { $ } from "bun";

rmSync("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  root: "src",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  external: [
    "blobatar",
    "blobatar/gaze",
    "blobatar/internal",
    "blobatar/uri",
    "blobatar/expression",
    "@angular/core",
    "@angular/common",
    "@angular/platform-browser",
    "tslib",
  ],
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

for (const out of build.outputs) {
  if (out.kind !== "sourcemap") continue;
  const map = await Bun.file(out.path).json();
  delete map.sourcesContent;
  await Bun.write(out.path, JSON.stringify(map));
}

await $`bunx tsc -p tsconfig.build.json`;

for (const out of build.outputs) {
  if (out.kind === "entry-point") console.log(`✓ ${out.path.replace(process.cwd() + "/", "")}`);
}
