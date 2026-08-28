/**
 * Where the film's imports of the library actually resolve to.
 *
 * The film renders against `packages/blobatar/src`, not against a built
 * `dist`, and that is the point: a film built from a stale bundle is a film
 * that demonstrates last week's behaviour while looking exactly like this
 * week's. Aliasing to source means a change to the motion layer shows up in the
 * next render with nothing to rebuild in between.
 *
 * ## Why this is its own file
 *
 * Two things resolve these: `remotion.config.ts`, which the CLI reads when it
 * renders, and `scripts/check-gaze.ts`, which drives the bundler
 * programmatically and therefore never sees the config at all. That second one
 * is easy to miss, and the way it fails is not a wrong number. It is
 * `"./animate" is not exported`, because `blobatar/animate` has no `exports`
 * entry and only ever worked through this alias.
 *
 * `tsconfig.json`'s `paths` is the third list and stays separate, because tsc
 * reads it for types and cannot read this. That one is checked by eye; these
 * two are checked by sharing.
 *
 * `process.cwd()` rather than `import.meta.url`: the CLI transpiles
 * `remotion.config.ts` to CJS, where `import.meta` is empty. It also only finds
 * that config when run from the app directory, so the cwd is `apps/video` for
 * both callers.
 */

import path from "node:path";

const src = (f: string) => path.resolve(process.cwd(), "../../packages/blobatar/src", f);

/**
 * `$` on each key is exact-match: without it `@blobatar/react` would resolve
 * through the `blobatar` alias and land on a directory that does not exist.
 */
export const alias: Record<string, string> = {
  blobatar$: src("index.ts"),
  "blobatar/blob$": src("blob.ts"),
  "blobatar/uri$": src("uri.ts"),
  "blobatar/expression$": src("expression.ts"),
  "@blobatar/react$": src("react.tsx"),
  "@blobatar/vue$": src("vue.ts"),
  "blobatar/animate$": src("animate.ts"),
  "blobatar/gaze$": src("gaze.ts"),
  "blobatar/motion.css$": src("motion.css"),
  "blobatar/gaze.css$": src("gaze.css"),
};
