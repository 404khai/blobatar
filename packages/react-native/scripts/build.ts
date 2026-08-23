/**
 * Publish build for the React Native adapter.
 *
 * Nothing of `blobatar` is inlined, for the reason the other adapters' builds
 * state: core is a peer dependency resolved at the consumer's install, so an
 * app using both this and another adapter shares one renderer rather than
 * carrying a private copy each.
 *
 * `react-native` and `react-native-svg` are external for a second reason on top
 * of that one. Both are native modules with a build step on the far side of the
 * bridge, and a bundled copy would not merely be wasteful — it would be a
 * second JavaScript half talking to a native half that was never linked for it.
 *
 * `target: "browser"` rather than `"node"`, matching the other adapters. Metro
 * is neither, and what actually matters here is the field the target selects:
 * ESM out, `react/jsx-runtime` calls left to the consumer's transform, and no
 * Node builtins assumed. Metro reads all three the same way a browser bundler
 * does.
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
  external: ["blobatar", "blobatar/internal", "react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-native", "react-native-svg"],
  // Carried over from core's build, and for the same reason: Bun picks the JSX
  // runtime off `process.env.NODE_ENV`, and a publish build run from a normal
  // shell has it unset — so without this the package ships `react/jsx-dev-runtime`
  // calls that resolve fine under Node and die in any consumer bundling for
  // production, where that specifier carries no `jsxDEV`. Stated here rather
  // than left to the shell so the output does not depend on who ran it.
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
