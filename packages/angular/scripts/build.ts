/**
 * Publish build for the Angular adapter.
 *
 * ng-packagr rather than `Bun.build`, and this is the one adapter where that is
 * not a choice. A component is only usable in an Angular app once Angular's own
 * compiler has turned its decorator and its signal inputs into a definition the
 * runtime reads. Transpiling the decorator as an ordinary function call — what
 * every other adapter's `Bun.build` would do — ships a class that an AOT app
 * refuses outright ("needs to be compiled using the JIT compiler") and whose
 * `input()` fields no template can bind to. `compilationMode: "partial"` in
 * `tsconfig.lib.json` is the library format: the consumer's build links it
 * against whichever Angular it runs.
 *
 * Nothing of `blobatar` is inlined, the same as every adapter: core is a peer
 * dependency, and ng-packagr externalizes every bare import by default.
 *
 * ng-packagr writes its own `package.json` into `dist`, expecting `npm publish
 * dist`. This repository publishes every package from its own directory, so
 * that file is removed and the root `package.json`'s `exports` point into the
 * layout ng-packagr produces. A second manifest one directory down would be
 * a second, unchecked answer to what this package exports.
 */

import { rmSync } from "node:fs";
import { ngPackagr } from "ng-packagr";

await ngPackagr()
  .forProject("ng-package.json")
  .withTsConfig("tsconfig.lib.json")
  .build();

rmSync("dist/package.json", { force: true });
rmSync("dist/README.md", { force: true });
rmSync("dist/LICENSE", { force: true });
rmSync("dist/.npmignore", { force: true });
rmSync("dist/gaze/package.json", { force: true });
