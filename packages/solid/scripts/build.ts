/**
 * Publish build for the Solid adapter.
 *
 * Solid needs babel-preset-solid for its JSX transform. The build uses
 * Bun's built-in Solid support.
 */

import { rmSync } from "node:fs";
import { $ } from "bun";

rmSync("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ["src/index.tsx"],
  outdir: "dist",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  external: [
    "blobatar",
    "blobatar/internal",
    "blobatar/uri",
    "solid-js",
    "solid-js/web",
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
