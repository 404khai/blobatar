/**
 * Where this site will be served from.
 *
 * Four things in the head need an absolute URL and cannot be given one by the
 * bundler: `og:url`, `og:image`, `rel="canonical"` and every `url` inside the
 * JSON-LD. Crawlers refuse to resolve a relative `og:image` against the page
 * they found it on, and a relative canonical is worth nothing to the entity
 * resolution it exists for.
 *
 * This used to live in `build.ts` as a string rewrite over the built document —
 * `content="/` became `content="https://blobatar.dev/`, narrow on purpose
 * because that was the shape only the OG tags had. JSON-LD ended that: its URLs
 * sit inside a JSON string, not a `content` attribute, and widening the rewrite
 * to reach them would have meant matching `"url":"/` and `href="/` too, each
 * with its own set of things it must not hit. Stating the origin once, here,
 * and interpolating it where a URL is written is the version of that with no
 * pattern to get wrong.
 *
 * Defaulted rather than required, and the default is a literal. This read
 * `VERCEL_PROJECT_PRODUCTION_URL` back when the site deployed to Vercel and
 * fell through to `null` otherwise, which left the tags relative; after the move
 * to Cloudflare that variable is never set, so every production build was
 * silently shipping cards no crawler could resolve. A hardcoded origin cannot
 * fail that way, and it is what the repo already does elsewhere — `snippet.ts`
 * hardcodes the same domain for the endpoint it tells people to call.
 *
 * `SITE_URL` still overrides, for a staging host or a preview that wants its
 * own cards. The dev server picks it up too, so a page served from localhost
 * says so in its canonical rather than pointing a crawler at production.
 *
 * The apex rather than `www`, matching the canonical the redirect rule sends
 * traffic to. Both hostnames are custom domains in `wrangler.jsonc`.
 */
/*
 * Guarded on `typeof process` because this module is imported by a *page* as
 * well as by the build: `/docs` renders URLs and the OpenAPI parameter table
 * in the browser, where `process` does not exist and an unguarded read is a
 * ReferenceError on load rather than a build error. The bundler folds the
 * branch away, so the browser gets the literal.
 */
export const ORIGIN =
  (typeof process === "undefined" ? undefined : process.env.SITE_URL) ??
  "https://blobatar.dev";

/** A root-relative path, as the absolute URL a crawler can use. */
export const absolute = (path: string) => `${ORIGIN}${path}`;

/** The repository, which is the same fact in a dozen places otherwise. */
export const REPO = "https://github.com/Alain00/blobatar";

/** The package on npm — `sameAs` for the identity, `downloadUrl` for the app. */
export const NPM = "https://www.npmjs.com/package/blobatar";

/** Issues: the front door for anything about the library or the endpoint. */
export const ISSUES = `${REPO}/issues`;

/**
 * The maintainer, elsewhere.
 *
 * No email anywhere on this site, deliberately. blobatar is a library with one
 * developer behind it, not a business with a support desk, and publishing a
 * personal address on a crawled page buys a contact route that GitHub and X
 * already provide — at the price of putting it in front of every harvester
 * that reads a page looking for one.
 */
export const GITHUB_PROFILE = "https://github.com/Alain00";
export const X_HANDLE = "@alain_0012";
export const X_PROFILE = "https://x.com/alain_0012";
