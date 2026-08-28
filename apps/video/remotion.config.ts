import { Config } from "@remotion/cli/config";
import { alias } from "./alias";

Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer("angle");

/**
 * The webpack half of the aliases in `tsconfig.json` — tsc reads `paths` for
 * types, and this is what the bundler resolves at render time. Both lists have
 * to say the same thing.
 *
 * The map itself lives in `./alias.ts`, because `scripts/check-gaze.ts` drives
 * the bundler programmatically and never reads this file. See the comment
 * there.
 */
Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: { ...current.resolve?.alias, ...alias },
  },
}));
