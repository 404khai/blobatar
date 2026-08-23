/**
 * Metro configuration, and it exists for exactly one problem.
 *
 * This app lives inside the workspace that builds the adapter, so
 * `@blobatar/react-native` is a symlink into `packages/react-native` rather
 * than a copy under this app's `node_modules`. Metro resolves a bare specifier
 * by walking up from the *importing file*, so `import { useMemo } from "react"`
 * inside the adapter's built `dist` finds `packages/react-native/node_modules/react`
 * — a different physical copy from the one this app loaded.
 *
 * Two Reacts in one app means the adapter's hooks read a null dispatcher, and
 * the app dies with `Cannot read property 'useMemo' of null` on the first
 * render. Nothing catches it earlier: `expo export` bundles both copies without
 * complaint, so only running the app finds it.
 *
 * ## Why this is fixed here and not by aligning versions
 *
 * Pinning the adapter's `react` devDependency to this app's version does fix
 * the duplication, and it was tried. It also deduplicates `react` across the
 * *entire* workspace, dragging `apps/site`, `apps/demo` and `apps/video` down
 * with it while `react-dom` stays where it was — and React refuses to run
 * against a `react-dom` of a different exact version. So a fix for this app
 * broke three others.
 *
 * The duplication is this app's problem, so it is this app's config that solves
 * it. **No consumer needs any of this**: `react`, `react-native` and
 * `react-native-svg` are peer dependencies of `@blobatar/react-native`, so an
 * ordinary install has exactly one copy of each and nothing to deduplicate.
 *
 * ## Why a targeted redirect rather than `disableHierarchicalLookup`
 *
 * Expo's monorepo guide reaches for `disableHierarchicalLookup: true` with an
 * explicit `nodeModulesPaths`. That answers a different layout than Bun's: here
 * every package's `node_modules` is a directory of symlinks into a central
 * store, and transitive dependencies are reachable only by walking up from the
 * file that needs them. Turning the walk off would strand them.
 *
 * So only the three packages that must be singletons are redirected, and every
 * other specifier resolves exactly as it did.
 */

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// The adapter and the library are compiled from outside this app's directory,
// so Metro has to be told to watch them or an edit to either never triggers a
// reload.
config.watchFolders = [workspaceRoot];

/**
 * The three that break if the app loads two of them. `react` breaks loudest
 * (hooks), but a second `react-native` or `react-native-svg` means a second
 * JavaScript half talking to native modules that were linked once.
 */
const SINGLETONS = new Set(["react", "react-native", "react-native-svg"]);

const upstream = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.startsWith("@")
    ? moduleName.split("/").slice(0, 2).join("/")
    : moduleName.split("/")[0];

  if (SINGLETONS.has(pkg)) {
    // Resolve as though the import came from this app's own entry point, which
    // is what makes every copy of the specifier land on the same file.
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "index.ts") },
      moduleName,
      platform,
    );
  }

  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
