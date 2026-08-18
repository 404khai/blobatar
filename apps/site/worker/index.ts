import { PREFIX, avatar } from "./avatar";

/**
 * blobatar.dev, whole.
 *
 * The static site and the avatar endpoint are one Worker on one domain because
 * they are one thing to deploy and one thing to reason about. Splitting them
 * across two platforms is what produced an afternoon of DNS archaeology.
 *
 * `run_worker_first` in `wrangler.jsonc` limits what reaches this function to
 * `/avatar/*`, so the site is served by Cloudflare's asset pipeline without a
 * Worker invocation — free and unmetered, where every request through here is
 * billed. The `startsWith` below is therefore belt-and-braces rather than the
 * routing itself: if the config were ever widened, the site must still be
 * served by assets rather than 404 out of the avatar parser.
 */
export default {
  fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    return new URL(request.url).pathname.startsWith(PREFIX)
      ? avatar(request)
      : env.ASSETS.fetch(request);
  },
};
