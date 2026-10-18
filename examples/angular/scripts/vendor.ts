/**
 * Packs `blobatar` and `@blobatar/angular` from this checkout into `vendor/`,
 * under fixed names so `package.json` can point at them across versions.
 *
 * Tarballs rather than `file:../../packages/angular`, and deliberately. A
 * tarball is what npm hands a real consumer — the `files` list, the `exports`
 * map, the ng-packagr output — so this app tests the package as published. A
 * directory link would also drag in `packages/angular/node_modules`, giving the
 * app a second copy of `@angular/core` and the injector errors that come with
 * it.
 *
 * `bun pm pack` runs each package's `prepack`, so this also rebuilds both.
 */

import { renameSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const root = join(import.meta.dir, "..", "..", "..");
const vendor = join(import.meta.dir, "..", "vendor");

const example = join(import.meta.dir, "..");

rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor);

// The tarball names never change, so npm treats a repack as already installed:
// the lockfile pins the old integrity and `node_modules` keeps the old copy.
// Clearing both is what makes the next `npm install` pick the new build up.
rmSync(join(example, "package-lock.json"), { force: true });
rmSync(join(example, "node_modules", "blobatar"), { recursive: true, force: true });
rmSync(join(example, "node_modules", "@blobatar", "angular"), { recursive: true, force: true });

for (const [dir, name] of [
  ["packages/blobatar", "blobatar.tgz"],
  ["packages/angular", "blobatar-angular.tgz"],
] as const) {
  await $`bun pm pack --destination ${vendor}`.cwd(join(root, dir));
  // The one tarball not yet renamed: bun names it after the package version.
  const packed = readdirSync(vendor).find((f) => /-\d+\.\d+\.\d+.*\.tgz$/.test(f));
  renameSync(join(vendor, packed!), join(vendor, name));
  console.log(`✓ vendor/${name}`);
}
