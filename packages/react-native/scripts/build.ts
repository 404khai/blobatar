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
 * bridge, and a bundled copy would not merely be wasteful. It would be a
 * second JavaScript half talking to a native half that was never linked for it.
 *
 * `target: "browser"` rather than `"node"`, matching the other adapters. Metro
 * is neither, and what actually matters here is the field the target selects:
 * ESM out, `react/jsx-runtime` calls left to the consumer's transform, and no
 * Node builtins assumed. Metro reads all three the same way a browser bundler
 * does.
 */

import { rmSync } from "node:fs";
import { $, type BunPlugin } from "bun";
import { transformAsync } from "@babel/core";

/**
 * Workletizing, which is why this package builds through Babel at all.
 *
 * `AnimatedBlobatar` runs its loops on the UI thread, and a function only
 * reaches that thread if `react-native-worklets`' Babel plugin has rewritten
 * it: the plugin captures the function's source and its closed-over values into
 * an `__initData` blob the UI runtime evaluates. A `'worklet'` directive that
 * nothing transformed is an ordinary function that silently runs on the JS
 * thread, which is the failure this whole step exists to prevent and which
 * looks exactly like success.
 *
 * **A library has to do this itself.** Metro applies the *app's* Babel config,
 * and an app's config is not guaranteed to reach into `node_modules`, so a
 * package that ships raw directives is a package whose motion works in some
 * consumers and not others. Every library that ships worklets compiles them
 * before publishing, and this is that step.
 *
 * It runs per source file rather than over the bundle, and the order matters:
 * Bun's minifier is free to drop a `'worklet'` directive prologue, and a
 * directive dropped before the plugin sees it is the silent failure above. So
 * Babel goes first, on the source, and what Bun then bundles and minifies is
 * already-transformed code whose captured `__initData` strings are fixed and
 * cannot be invalidated by renaming anything around them.
 *
 * `scripts/build.ts` asserts the output actually contains worklets at the end,
 * because "the plugin was configured" and "the plugin fired" are different
 * facts and only the second one matters.
 */
// The plugin embeds a source map per worklet unless it believes it is building
// for production, and a publish build run from a normal shell has `NODE_ENV`
// unset. Left unset it shipped a 218 kB `dist` against the 2.6 kB it should be,
// which is the same class of trap as the JSX runtime one the `define` below
// documents: a build whose output depends on who ran it.
process.env.NODE_ENV = "production";

const worklets: BunPlugin = {
  name: "react-native-worklets",
  setup(build) {
    build.onLoad({ filter: /\.tsx?$/ }, async args => {
      const source = await Bun.file(args.path).text();
      const out = await transformAsync(source, {
        filename: args.path,
        babelrc: false,
        configFile: false,
        cwd: import.meta.dir + "/..",
        presets: [
          "@babel/preset-typescript",
          // `development: false` for the same reason the `define` below exists:
          // the runtime this picks is baked into the published file, and
          // `react/jsx-dev-runtime` carries no `jsxDEV` in a consumer's
          // production bundle.
          ["@babel/preset-react", { runtime: "automatic", development: false }],
        ],
        plugins: ["react-native-worklets/plugin"],
        sourceMaps: false,
      });
      if (!out?.code) throw new Error(`babel produced nothing for ${args.path}`);
      return { contents: out.code, loader: "js" };
    });
  },
};

rmSync("dist", { recursive: true, force: true });

const build = await Bun.build({
  plugins: [worklets],
  entrypoints: ["src/index.tsx", "src/animated.tsx"],
  outdir: "dist",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  external: ["blobatar", "blobatar/internal", "blobatar/idle", "react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-native", "react-native-svg", "react-native-reanimated", "react-native-worklets"],
  // Carried over from core's build, and for the same reason: Bun picks the JSX
  // runtime off `process.env.NODE_ENV`, and a publish build run from a normal
  // shell has it unset, so without this the package ships `react/jsx-dev-runtime`
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

/**
 * "The plugin was configured" and "the plugin fired" are different facts, and
 * only the second one matters: an untransformed `'worklet'` directive is an
 * ordinary function that runs on the JS thread, silently, at the exact moment
 * somebody is measuring whether the UI thread helped.
 */
const animated = await Bun.file("dist/animated.js").text();
const hashes = animated.match(/__workletHash/g)?.length ?? 0;
if (hashes < 10) {
  console.error(`✗ dist/animated.js carries ${hashes} worklets; the Babel step did not run`);
  process.exit(1);
}
console.log(`✓ ${hashes} worklets compiled`);
