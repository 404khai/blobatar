import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

/**
 * What each adapter *ships*, read rather than run.
 *
 * This moved here from `blobatar`'s `scripts/smoke.mjs` when the adapters left
 * core, and it had to move rather than be dropped: it is the only check that
 * sees a build-mode mistake. A package built against the development JSX
 * transform passes every rendering assertion in this repo — Node resolves
 * `react/jsx-dev-runtime` and `jsxDEV` exists, so the component renders — and
 * then throws `jsxDEV is not a function` in any consumer bundling for
 * production. Nothing observable at runtime here distinguishes the two, so the
 * emitted specifier itself is the assertion.
 *
 * Core's copy still runs, over an empty allow-list: it imports nothing external
 * at all now. This one is where the list is non-empty, and therefore where the
 * bug can actually hide.
 */

const require_ = createRequire(import.meta.url);
const read = (pkg: string) => readFileSync(require_.resolve(pkg), "utf8");

const ADAPTERS: [string, string[]][] = [
  ["@blobatar/react", ["blobatar", "blobatar/react", "blobatar/internal", "blobatar/uri", "react", "react/jsx-runtime"]],
  ["@blobatar/vue", ["blobatar", "blobatar/vue", "blobatar/internal", "blobatar/uri", "vue"]],
];

const DEV_ONLY: [string, string][] = [
  ["jsx-dev-runtime", "the development JSX transform — it throws in production bundlers"],
  ["jsxDEV", "a call into the development JSX transform"],
  ["process.env", "a bare `process` reference — undefined in browsers and in Workers"],
];

describe("what the adapters ship", () => {
  for (const [pkg, allowed] of ADAPTERS) {
    test(`${pkg} ships production code`, () => {
      const code = read(pkg);
      for (const [needle, why] of DEV_ONLY) {
        expect(code, `${pkg} contains ${needle} — ${why}`).not.toContain(needle);
      }
    });

    test(`${pkg} imports only what it declares`, () => {
      const code = read(pkg);
      const specifiers = [...code.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]!);
      const external = specifiers.filter((s) => !s.startsWith("."));
      for (const s of external) {
        expect(allowed, `${pkg} imports ${s}, which it does not declare`).toContain(s);
      }
      // Core must be imported, never inlined — that is the whole point of the
      // split. An adapter that bundled the renderer would ship a second copy of
      // it to anyone using two frameworks, and would silently stop tracking
      // core's version.
      //
      // Asserted as "some entry point of core", not a specific one, because the
      // two are legitimately different right now: an adapter that re-exports a
      // deprecated subpath imports `blobatar/react`, and one written against
      // the split imports `blobatar/internal`. Both are core. Naming one would
      // make this test fail on a shape it should accept, and naming neither
      // would let a bundled copy through.
      expect(
        external.some((s) => s === "blobatar" || s.startsWith("blobatar/")),
        `${pkg} inlines the renderer instead of importing it`,
      ).toBe(true);
    });
  }
});

/**
 * The half of lockstep that tooling cannot give you.
 *
 * `fixed` in `.changeset/config.json` keeps the published versions in step. It
 * does nothing about *installs*: npm resolves each package independently, so
 * `@blobatar/react@4` next to `blobatar@3` is a clean install and a wrong
 * picture, because under ADR-0008 the major names the generation.
 *
 * The exact-major peer range is what refuses that install. It is asserted here
 * rather than trusted because it is exactly the kind of field release tooling
 * rewrites on its way past: `changeset version` updates workspace ranges, and
 * a rewrite to `^3.0.0` would permit the pair this range exists to forbid.
 *
 * Deriving the expected range from core's own version is what makes that
 * catchable. On the release commit — where every version bumps at once — this
 * test is the thing that fails if the range did not bump with them, or bumped
 * into a caret. Hard-coding the major here would make it pass by construction
 * and guard nothing.
 */
describe("the adapters pin core to one major", () => {
  const core = require_("blobatar/package.json") as { version: string };
  const major = core.version.split(".")[0];

  for (const [pkg] of ADAPTERS) {
    test(`${pkg} peer-depends on blobatar@${major}.x exactly`, () => {
      const manifest = require_(`${pkg}/package.json`) as {
        version: string;
        peerDependencies?: Record<string, string>;
      };
      expect(manifest.peerDependencies?.blobatar).toBe(`${major}.x`);
      // Lockstep: the adapter's own version must be core's version.
      expect(manifest.version).toBe(core.version);
    });
  }
});
