/**
 * `/openapi.json` — the endpoint's spec, as a static asset.
 *
 * Generated from `apps/api`, which is where the endpoint is, rather than
 * written here: `worker/index.ts` already imports that Worker's handler so the
 * two deployments cannot answer differently, and this is the same argument
 * applied to the description of what they answer.
 *
 * Written into `public/` at build time and at dev start-up, exactly as
 * `llms.txt` and the favicon are, and for the same reason it matters here more
 * than usual: the site's Worker runs only on `/avatar/*` and `/wall/*` (see
 * `run_worker_first` in `wrangler.jsonc`), so anything else this domain serves
 * has to be a file. A route would cost a billed invocation per fetch to return
 * a document that changes on deploys.
 *
 * The origin is this site's, not the request's — a file cannot know who asked.
 * That is correct for blobatar.dev and is the one difference from the copy
 * `apps/api` serves, which derives it per request so a fork's generated client
 * calls the fork.
 */
import { openapi } from "../api/src/openapi";
import { ORIGIN } from "./origin";

export const OPENAPI_PATH = new URL("./public/openapi.json", import.meta.url).pathname;

export async function writeOpenApi() {
  await Bun.write(OPENAPI_PATH, `${JSON.stringify(openapi(ORIGIN), null, 2)}\n`);
}
